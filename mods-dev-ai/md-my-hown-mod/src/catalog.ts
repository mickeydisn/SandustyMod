/**
 * Live catalogues for form pickers: game registries + this mod's stored config.
 */
// `getSandkit`/`safe` are host-free helpers. The api itself comes from
// `mysandkit`, whose `api.*` members are resolved per call — this file used to
// import `api` from here, but that export captured `sandkit.api` once at module
// load, so a host injected later left every call below reading `undefined` and
// the pickers silently rendering empty. See the note on `getSandkit`.
import { getSandkit, safe } from "./api.ts";
import { api as skApi } from "./packages/mysandkit.ts";
import { configIsHidden, humanise } from "./constants.ts";
import { loadConfig } from "./config/store.ts";
import type { Tab } from "./ui/schema.ts";
import type { ListRow } from "./ui/definition/types.ts";
import { allUnlockNodes, DEFAULT_UNLOCK_NODE } from "./ui/tech-link.ts";
import type { HandlerMeta, HandlerSlot } from "./handler/core/handler-registry.ts";
// Imported as a value, not a type: `handler-registry.ts` has no imports of its
// own, so this cannot cycle, and the pickers must work even when the hook
// module has not yet published its `__mdHandlers` global.
import {
    allHandlerTypes,
    HANDLER_META,
    itemActionHandlersFor,
} from "./handler/core/handler-registry.ts";
// The projectile presets. A value import, and deliberately *not* through
// `handler-registry.ts`: these are `ProjectileOptionFn`s, not actions, so they
// live in their own registry and are compiled by `compileProjectile`.
import { PROJECTILE_OPTION_DOCS, PROJECTILE_OPTIONS } from "./handler/projectile-option/index.ts";

/**
 * One choice for a reference field.
 *
 * `source` is not decoration: it is what lets the panel tell the user how many
 * of the available ids the *game* already has, and which ones this mod added.
 * Every list sets it, and the "native" summary box under a field reads it. A
 * picker that cannot say "38 in the game, 2 yours" leaves the user guessing
 * whether the list is complete — which is the whole question when you are
 * wondering what id to type, and why the field must not accept typing at all.
 */
export type Opt = {
    value: string;
    label: string;
    color?: string;
    source?: "game" | "mod";
    /**
     * The object is deliberately kept out of normal use: an element the author
     * marked `hidden`, a structure marked `hideFromBuildMenu`.
     *
     * **Set, not filtered.** A picker that simply omits these cannot tell the
     * difference between "this mod has no such object" and "there are three and
     * they are hidden", so the user cannot find the one they know exists. The
     * selector hides these rows behind a checkbox instead — see
     * `ui/panel/component/selector/`.
     */
    hidden?: boolean;
};

function sk(): any {
    return getSandkit();
}

function enumOpts(name: string): Opt[] {
    const e = sk()?.enums?.[name];
    if (!e || typeof e !== "object") return [];
    const out: Opt[] = [];
    for (const [k, v] of Object.entries(e)) {
        if (typeof k === "string" && Number.isNaN(Number(k))) {
            out.push({ value: String(v), label: `${k} (${v})` });
        }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
}

/** Enum member *names* only. Split from `enumOpts`, whose guard compared a *number* against a map keyed by *id*. */
function enumNames(name: string): string[] {
    const e = sk()?.enums?.[name];
    if (!e || typeof e !== "object") return [];
    return Object.keys(e).filter((k) => Number.isNaN(Number(k))).sort();
}

/** The numeric value of one enum member, or undefined if there is no such member. */
function enumValue(enumName: string, member: string): number | undefined {
    const v = enumRawValue(enumName, member);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** One enum member's value, whatever type it has. */
function enumRawValue(enumName: string, member: string): unknown {
    const e = sk()?.enums?.[enumName];
    if (!e || typeof e !== "object") return undefined;
    return (e as Record<string, unknown>)[member];
}

function colorFromMeta(meta: unknown): string | undefined {
    if (typeof meta === "number" && Number.isFinite(meta)) {
        const rgb = meta > 0xffffff ? (meta >>> 0) & 0xffffff : meta & 0xffffff;
        return `#${rgb.toString(16).padStart(6, "0")}`;
    }
    if (typeof meta === "string" && /^#?[0-9a-fA-F]{6}/.test(meta)) {
        return meta.startsWith("#") ? meta.slice(0, 7) : `#${meta.slice(0, 6)}`;
    }
    return undefined;
}

/** Element ids from the live registry: the enum maps name→number, never id. Hidden types excluded unless asked. */
export function listElements(opts?: { includeHidden?: boolean }): Opt[] {
    const map = new Map<string, Opt>();
    const includeHidden = !!opts?.includeHidden;
    // Ids the registry knows about but we are hiding. The enum fallback below
    // walks the same types, so without this a hidden element would be filtered
    // out of the registry pass and then straight back in through the fallback.
    const hidden = new Set<string>();

    // ── the live registry: the only source of real ids ──
    const types = skApi.elements.getRegisteredTypes();
    for (const t of types) {
        const def = skApi.elements.getDefinitionByType(t) as
            | {
                id?: string;
                name?: string;
                nameKey?: string;
                hidden?: boolean;
                metaColor?: unknown;
            }
            | undefined;
        // `getIdByType` is the documented way from a type number to an id, and
        // unlike the enum name it is never a guess.
        const id = def?.id ?? skApi.elements.getIdByType(t);
        if (!id) continue;
        if (def?.hidden === true) {
            hidden.add(String(id));
            // Only the *legacy* caller opts out. By default the row is carried
            // with `hidden: true` so the selector can offer it behind a checkbox —
            // see the note on `Opt.hidden`.
            if (!includeHidden) continue;
        }
        const name = def?.name ?? skApi.elements.getNameByType(t) ?? def?.nameKey ??
            id;
        map.set(String(id), {
            value: String(id),
            label: String(name),
            color: colorFromMeta(def?.metaColor),
            source: "game",
            // Carried, not filtered: the selector decides whether to show these.
            hidden: def?.hidden === true,
        });
    }

    // ── enum fallback, for types with no readable definition ──
    // Only for ids the registry did not already give us, and the id comes from
    // `getIdByType` rather than a lowercased enum name.
    for (const name of enumNames("ElementType")) {
        const type = enumValue("ElementType", name);
        if (type === undefined) continue;
        const id = skApi.elements.getIdByType(type);
        if (!id || map.has(String(id))) continue;
        if (hidden.has(String(id))) continue;
        map.set(String(id), { value: String(id), label: name, source: "game" });
    }

    // ── this mod's config, whether or not it has been registered yet ──
    for (const el of loadConfig().elements ?? []) {
        if (!el?.id) continue;
        map.set(el.id, {
            value: el.id,
            label: `${el.name || el.id} (this mod)`,
            source: "mod",
            color: typeof el.metaColor === "string" ? el.metaColor : colorFromMeta(el.metaColor),
            // The mod's own `hidden` flag, so a hidden element the user just made
            // is filtered by the same rule as one the game ships.
            hidden: el.hidden === true,
        });
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Energy network ids: the engine's default, plus whatever this mod defines.
 *
 * The engine has no "register a network" call and no way to enumerate the ones
 * in play — `options.energyType` is a bare string. So the only source of truth
 * is our own config, plus the one name the game ships with.
 *
 * That default is seeded in deliberately. Every existing config that never
 * mentions a network means the default, so a list built only from the config
 * would not contain the value those configs already use, and the field would
 * open on a blank select and push the user into inventing a duplicate of the
 * network their machines are already on.
 */
export const DEFAULT_ENERGY_NETWORK = "power";

/**
 * Per panel: the objects that already exist in the game and are of *this* kind.
 *
 * Only five screens can answer this, because only five have a registry to read.
 * `api.elements`, `api.structures`, `api.items` and the terrain list can be
 * enumerated; a recipe, a trigger or a signal is something the mod defines, and
 * there is nothing in the game to enumerate before you do.
 *
 * **What consumes this.** The per-field native box under a reference picker
 * (`nativeBox` in `panel.ts`), and `pickers.test.ts` asserts every key here has
 * an enumeration behind it. So this stays a `Opt[]` table rather than being folded
 * into the definitions' `discover`: a picker needs a flat option list, while
 * `discover` needs the richer `ListRow` that carries the host's own definition.
 * Same discovery underneath, two shapes on purpose.
 */
export const PANEL_NATIVES: Partial<Record<Tab, () => Opt[]>> = {
    elements: () => listElements(),
    structures: () => listStructures(),
    items: () => listItems(),
    terrains: () => listTerrains(),
    sprites: () => listSpriteIds(),
};

export function listEnergyNetworkOpts(): Opt[] {
    const map = new Map<string, Opt>();
    map.set(DEFAULT_ENERGY_NETWORK, {
        value: DEFAULT_ENERGY_NETWORK,
        label: `${DEFAULT_ENERGY_NETWORK} — the game's own network`,
    });
    for (const n of loadConfig().energyNetworks ?? []) {
        if (!n?.id) continue;
        map.set(n.id, {
            value: n.id,
            label: n.name ? `${n.name} (${n.id})` : `${n.id} (this mod)`,
            source: "mod",
        });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listStructures(): Opt[] {
    const map = new Map<string, Opt>();

    // `getAvailableTypes()` and `getUnlockedTypes()` both return a
    // **`Set<StructureRef>`**, and `StructureRef` is `StructureType | StructureId`
    // — a *number or a string*. Both facts matter:
    //
    //  - a `Set` is not an array, so an `Array.isArray` check alone drops it
    //    entirely and the screen falls back to the enum alone;
    //  - a member may be the **id string** already, in which case there is
    //    nothing to resolve: calling `getDefinitionByType("myMod.furnace")` on
    //    it is at best a wasted call and at worst a throw, and the fallback
    //    `String(t)` is then the only thing keeping the row alive.
    //
    // An earlier note here claimed all four probes were absent from the public
    // API index. Two of them are not: `doc-bundel/public-api.json` lists
    // `structures.getAvailableTypes() -> Set<StructureRef>` and
    // `structures.getUnlockedTypes() -> Set<StructureRef>`. `getRegisteredTypes`
    // and `getAll` do not exist and stay as forward-looking probes.
    const tryList: Array<() => unknown> = [
        () => skApi.structures.getRegisteredTypes(),
        () => skApi.structures.getAvailableTypes(),
        () => skApi.structures.getUnlockedTypes(),
        () => skApi.structures.getAll(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn);
        if (!raw) continue;
        const arr = raw instanceof Set ? [...raw] : Array.isArray(raw) ? raw : [];
        for (const t of arr) {
            // A ref that is already a string id needs no resolution.
            if (typeof t === "string" && t) {
                if (map.has(t)) continue;
                const def = skApi.structures.getDefinitionByType(t);
                map.set(t, {
                    value: t,
                    label: String(def?.name ?? def?.nameKey ?? t),
                    source: "game",
                    // A structure's equivalent of an element's `hidden`. Read
                    // through `configIsHidden` rather than testing the field here,
                    // so this picker and the list screen cannot disagree about
                    // which objects are hidden.
                    hidden: configIsHidden(def ?? {}, "structures"),
                });
                continue;
            }
            const def = skApi.structures.getDefinitionByType(t as number | string);
            const id = def?.id ??
                skApi.structures.getIdByType(t as number) ??
                skApi.structures.getTypeName(t as number) ??
                String(t);
            const name = def?.name ?? def?.nameKey ?? id;
            map.set(String(id), {
                value: String(id),
                label: String(name),
                source: "game",
                hidden: configIsHidden(def ?? {}, "structures"),
            });
        }
    }

    for (const o of enumOpts("StructureType")) {
        const name = o.label.split(" ")[0];
        if (![...map.keys()].some((k) => k === name || k === o.value)) {
            // Tagged `game`: this is a built-in structure type, and a list that
            // asks "mod or not" must not file it under the mod. It was untagged
            // before, which made every game structure look like the user's own.
            map.set(name, { value: name, label: o.label, source: "game" });
        }
    }

    for (const st of loadConfig().structures ?? []) {
        if (st?.id) {
            map.set(st.id, {
                value: st.id,
                label: `${st.name || st.id} (this mod)`,
                source: "mod",
                // Same flag, same rule as an element's `visibleInPicker`, and the
                // same helper — so a structure the list calls hidden is not
                // offered as ordinary here.
                hidden: configIsHidden(st, "structures"),
            });
        }
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function listItems(): Opt[] {
    const map = new Map<string, Opt>();
    const tryList = [
        () => skApi.items.getRegistered(),
        () => skApi.items.getAll(),
        () => skApi.items.list(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn);
        if (!raw) continue;
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.keys(raw) : [];
        for (const entry of arr) {
            if (typeof entry === "string") {
                map.set(entry, { value: entry, label: entry, source: "game" });
            } else if (entry && typeof entry === "object") {
                const id = (entry as any).id ?? String(entry);
                map.set(String(id), { value: String(id), label: (entry as any).name ?? id });
            }
        }
    }
    // Enum fallback.
    //
    // `ItemId` is the one reference list with **no** enumeration API and **no**
    // `getIdByType` to reverse-map it, so the enum is the only source of the
    // game's item ids. Its *value* is the id; its *member name* is a display
    // name and is not an id. Storing `o.label.split(" ")[0]` — the
    // display name — as the value would offer ids the engine cannot resolve.
    // Only a string-valued member is taken, because only that can be an id.
    for (const name of enumNames("ItemId")) {
        const v = enumRawValue("ItemId", name);
        if (typeof v !== "string" || !v) continue;
        if (map.has(v)) continue;
        // Tagged `game`, like the two passes above: these are the host's own
        // item ids, and a "mod or not" filter that could not tell them apart
        // would file every built-in tool under the mod.
        map.set(v, { value: v, label: v, source: "game" });
    }
    for (const it of loadConfig().items ?? []) {
        if (!it?.id) continue;
        map.set(it.id, { value: it.id, label: `${it.name || it.id} (this mod)`, source: "mod" });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Terrain ids from the registry: `CellType` is name→number, never id. Unresolvable members are dropped. */
export function listTerrains(): Opt[] {
    const map = new Map<string, Opt>();

    for (const name of enumNames("CellType")) {
        const type = enumValue("CellType", name);
        if (type === undefined) continue;
        const id = skApi.terrains.getIdByType(type);
        if (!id || map.has(String(id))) continue;
        map.set(String(id), { value: String(id), label: name, source: "game" });
    }

    for (const t of loadConfig().terrains ?? []) {
        if (!t?.id) continue;
        map.set(t.id, { value: t.id, label: `${t.name || t.id} (this mod)`, source: "mod" });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** `structure.linkedClearance` — the only test anywhere is `=== "allOrNothing"`, so any other value skips it. */
export function listLinkedClearance(): Opt[] {
    return [
        {
            value: "",
            label: "Per cell (default) — every blocked cell is rejected on its own",
        },
        {
            value: "allOrNothing",
            label: "All or nothing — one blocked cell rejects the whole footprint",
        },
    ];
}

/** Legal `terrain.materialId` values: 101–149, the engine's only obstacle range. Leads with the computed next-free id. */
export function listMaterialIds(): Opt[] {
    const used = (loadConfig().terrains ?? [])
        .map((t) => Number((t as { materialId?: unknown } | undefined)?.materialId))
        .filter((n) => Number.isFinite(n));
    const taken = new Set(used);

    // Highest id already in use, so "next free" really is free.
    let next = 101;
    for (const n of used) if (n >= next && n < 149) next = n + 1;

    const opts: Opt[] = [
        { value: "", label: "Leave empty — the engine uses its default (150)" },
    ];
    if (next <= 149) {
        opts.push({
            value: String(next),
            label: `${next} — next free id${taken.size ? " (recommended)" : ""}`,
        });
    }
    for (let n = 101; n <= 149; n++) {
        if (taken.has(n) || n === next) continue;
        opts.push({ value: String(n), label: String(n) });
    }
    return opts;
}

/**
 * Built-in `draw` functions for `structures.register({ draw })`.
 *
 * `draw` is a **function**, not data. The engine stores it per structure *type*
 * (`T(id, fn)` into a map) and calls it as:
 *
 *     fn(session, instance, { tilemap, ctx, useTilemap, placing, opts })
 *       → false  : fall through to the normal sprite render
 *       → else   : the frame is handled, the default render is skipped
 *
 * So it cannot be expressed in JSON, which is why the config holds a *key* and
 * `apply.ts` resolves it to one of these. Anything not in this table does not
 * reach the game.
 *
 * The set stays small on purpose, but it is no longer a placeholder: each entry
 * is written against the API a shipping mod actually uses
 * (`__scraped-mods/workshop/3791498201`). Adding more means writing them that
 * way, not guessing.
 */
export interface DrawFnMeta {
    key: string;
    label: string;
    /** What the function does, in one line. */
    doc: string;
    /** True when it returns false and lets the engine draw as normal. */
    passthrough: boolean;
}

export const DRAW_FUNCTIONS: DrawFnMeta[] = [
    {
        key: "default",
        label: "Normal sprite render",
        doc: "No custom draw. The engine renders the sprite exactly as it would anyway.",
        passthrough: true,
    },
    {
        key: "outline",
        label: "Outline the footprint",
        doc: "Draws a thin box around the whole footprint, then lets the sprite render normally underneath. Useful when a large structure's sprite makes its true extent hard to see.",
        passthrough: false,
    },
    {
        key: "hidden",
        label: "Draw nothing",
        doc: "Handles the frame without drawing it, so the structure is invisible but still placed and still simulates.",
        passthrough: false,
    },
    {
        key: "drawnSprite",
        label: "Draw an edited sprite",
        doc: "Paints the sprite named by Image name directly from the bytes saved in this mod, so a sprite drawn in the Sprite editor shows even if the game would not load it as a file.",
        passthrough: false,
    },
];

/** Option list for the `draw` field. */
export function listDrawFunctions(): Opt[] {
    return DRAW_FUNCTIONS.map((d) => ({ value: d.key, label: `${d.label} — ${d.doc}` }));
}

/** One-line description for a draw key, or undefined when unknown. */
export function drawDoc(key: string): string | undefined {
    return DRAW_FUNCTIONS.find((d) => d.key === key)?.doc;
}

export function listMatterTypes(): Opt[] {
    // Static lowercase names: resolveMatterType() maps them to MatterType numbers.
    // (Numeric enum strings do NOT resolve reliably — keep values lowercase.)
    return [
        { value: "solid", label: "Solid (1)" },
        { value: "liquid", label: "Liquid (2)" },
        { value: "particle", label: "Particle (3)" },
        { value: "gas", label: "Gas (4)" },
        { value: "static", label: "Static (5)" },
        { value: "slushy", label: "Slushy (6)" },
        { value: "wisp", label: "Wisp (7)" },
        { value: "powder", label: "Powder (8)" },
    ];
}

/** The same table, by value — for reading a number back as a name. */
export const MATTER_NAME_BY_VALUE: Record<number, string> = {
    1: "solid",
    2: "liquid",
    3: "particle",
    4: "gas",
    5: "static",
    6: "slushy",
    7: "wisp",
    8: "powder",
};

/**
 * Engine build-mode types (structures.register → buildModes[].type).
 * Verified in doc/doc-artifacts/doc.api/definitions/api.structures.definition.md
 */
// The three data constants below are implementation details of their list*
// wrappers and are not part of the module's public surface.
const BUILD_MODE_TYPES = [
    "single",
    "singleDirectional",
    "line",
    "rectangle",
    "rectangleDirectional",
    "launcherRectUp",
    "launcherRectSide",
] as const;

export function listBuildModeTypes(): Opt[] {
    return BUILD_MODE_TYPES.map((v) => ({ value: v, label: v }));
}

/**
 * Built-in build-menu categories (engine list `LR`, doc-tech/13).
 * Free-form strings are allowed by the engine, but these 20 get localized labels.
 */
const STRUCTURE_CATEGORIES = [
    "misc",
    "logic",
    "blocks",
    "testBlocks",
    "construction",
    "debug",
    "drones",
    "energy",
    "excavation",
    "logistics",
    "production",
    "tools",
    "transportation",
    "utility",
    "weapons",
    "economy",
    "fluids",
    "thermal",
    "lighting",
    "special",
] as const;

/**
 * Suggested `KeyCode` values for an input binding's default keys.
 *
 * The engine's `KeyCode` is a `LooseString` union, not a closed enum: a
 * modifier alias ("Shift"), a raw `KeyboardEvent.code` ("KeyO"), or a chord
 * ("Control+KeyC") are all accepted, and `defaultKeys` is a `KeyCode[]`. So
 * this is an offer, not a whitelist — the field itself stays free text.
 */
export const KEY_CODE_SUGGESTIONS = [
    "Shift",
    "Alt",
    "Control",
    "Meta",
    "ShiftLeft",
    "ShiftRight",
    "AltLeft",
    "AltRight",
    "ControlLeft",
    "ControlRight",
    "MetaLeft",
    "MetaRight",
    "Escape",
    "Enter",
    "Space",
    "Tab",
    "Backspace",
    "Delete",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyE",
    "KeyG",
    "KeyM",
    "KeyO",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyX",
    "KeyZ",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "F1",
    "F2",
    "F5",
    "F11",
    "Mouse0",
    "Mouse1",
    "Mouse2",
];

export function listKeyCodes(): Opt[] {
    return KEY_CODE_SUGGESTIONS.map((v) => ({ value: v, label: v }));
}

export function listStructureCategories(): Opt[] {
    return [...STRUCTURE_CATEGORIES].map((v) => ({ value: v, label: v }));
}

/**
 * The ONLY ids accepted by api.structures.recipes.register — anything else throws
 * "Structure recipe ID \"…\" is not supported." (doc/api/shared/api.recipes.md)
 */
export const RECIPE_MACHINES = [
    "planterBox",
    "shaker",
    "kineticPress",
    "condenser",
    "steamDryer",
    "synthesizer",
    "snowmaker",
    "smelter",
] as const;

export function listRecipeMachines(): Opt[] {
    return [
        { value: "planterBox", label: "Planter box / grower" },
        { value: "shaker", label: "Shaker (above / below)" },
        { value: "kineticPress", label: "Kinetic press (velocity)" },
        { value: "condenser", label: "Condenser" },
        { value: "steamDryer", label: "Steam dryer" },
        { value: "synthesizer", label: "Synthesizer" },
        { value: "snowmaker", label: "Snowmaker" },
        { value: "smelter", label: "Smelter" },
    ];
}

/** Contact-reaction orientation (reactions.registerContact). */
export function listContactOrientation(): Opt[] {
    return [
        { value: "any", label: "any — touch in any arrangement" },
        { value: "stacked", label: "stacked — vertical only" },
    ];
}

/**
 * Documented interceptable hooks (doc-tech/03-hooks-reference.md) + "custom".
 * Restrictive by default: users pick a real hook instead of typing anything.
 */
const HOOK_IDS = [
    "element:move",
    "element:blocked",
    "element:move:blocked",
    "element:update",
    "element:duration",
    "element:duration:expire",
    "cell:process",
    "fire:element:burn",
    "fire:element:ignite",
    "building:place",
    "projectile:hit",
    "teleport:effect",
] as const;

export function listHookIds(): Opt[] {
    return [
        ...HOOK_IDS.map((v) => ({ value: v, label: v })),
        { value: "__custom__", label: "custom hook id (type below)" },
    ];
}

/** Sprites known to the game + this mod's config. */
export function listSpriteIds(): Opt[] {
    const map = new Map<string, Opt>();
    const tryList = [
        () => skApi.sprites.getLoaded(),
        () => skApi.sprites.getAll(),
        () => skApi.sprites.list(),
        () => skApi.sprites.getRegistered(),
    ];
    for (const fn of tryList) {
        const raw = safe(fn);
        if (!raw) continue;
        const arr = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.keys(raw) : [];
        for (const entry of arr) {
            if (typeof entry === "string") map.set(entry, { value: entry, label: entry });
            else if (entry && typeof entry === "object") {
                const id = String((entry as any).id ?? "");
                if (id) map.set(id, { value: id, label: id });
            }
        }
    }
    // Config entries reference their icon by graphics key; when the path points
    // at a bundled asset, surface that so the sprite form can prefill it.
    for (const sp of loadConfig().sprites ?? []) {
        if (!sp?.id) continue;
        const lib = LIBRARY_ICONS.find((i) => i.path === sp.path);
        // A drawn sprite (the Sprite editor) is base64 PNG in `source`, not a
        // `path` — and so has no `lib` match and may not be in the game's registry
        // at all. It is still selectable, and it is still the only thing that shows
        // up when a structure uses the `drawnSprite` draw key, so it is marked
        // rather than left looking like an ordinary bundled asset.
        const drawn = typeof sp.source === "string" && sp.source.startsWith("data:");
        map.set(sp.id, {
            value: sp.id,
            label: drawn
                ? `${sp.id} (drawn)`
                : lib
                ? `${sp.id} → ${lib.name}`
                : `${sp.id} (this mod)`,
            source: "mod",
        });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ── Bundled icon library ─────────────────────────────────────────────────────
// assets/icons/*.png are scanned at build time (tools/gen-sprite-library.ts)
// because the game runtime has no filesystem access. Every entry is a real PNG
// shipped inside this mod, so a sprite can be registered straight from it.

export interface LibraryAsset {
    /** Base name, e.g. "icon-alien". */
    name: string;
    /** Mod-root-relative path passed directly to sprites.loadFromMod. */
    path: string;
    /** Cell sizes found on disk, e.g. ["1x1", "2x2", "3x3"]. */
    sizes: string[];
    /**
     * The PNG inlined as a data URL. The runtime cannot read the file, so the
     * generator bakes the bytes in and the panel renders these directly.
     */
    preview: string;
    /** Pixel size of the previewed PNG — 16×16 for a 1x1 icon. */
    previewW: number;
    previewH: number;
}

import { LIBRARY_ICONS } from "./generated/sprite-library.ts";
export { LIBRARY_ICONS };

/** All bundled icons, sorted by name. */
export function listLibraryAssets(): LibraryAsset[] {
    return [...LIBRARY_ICONS].sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive substring search over the bundled icon library. */
export function searchLibraryAssets(query: string): LibraryAsset[] {
    const q = query.trim().toLowerCase();
    const all = listLibraryAssets();
    if (!q) return all;
    return all.filter((i) => i.name.toLowerCase().includes(q));
}

/** Element ids + a "∅ consume (null)" sentinel — used by contact outputs. */
export function listOutputTargets(): Opt[] {
    return [{ value: "__null__", label: "∅ consume (null)" }, ...listElements()];
}

/** Code handlers usable as generic callbacks (signals, triggers, projectiles…). */
export function listAnyHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listAnyHandlerKeys) {
            return m.listAnyHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return listHandlerKeys();
}

/** Code handlers wired as structures.processing `process(structure, context)`. */
export function listProcessorKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listProcessorKeys) {
            return m.listProcessorKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return [{ value: "processorLog", label: "processorLog" }, {
        value: "processorNoop",
        label: "processorNoop",
    }];
}

// ── Domain-scoped handler pickers ─────────────────────────────────────────────
// A flat list of ~30 keys is unusable: a signal handler and a projectile options
// factory have nothing to do with each other. Each domain gets its own list, and
// options are labelled `key — what it does` so the description is visible in the
// dropdown itself rather than hidden behind a tooltip.

/** Read the handler registries exposed by src/handler/handlers.ts at runtime. */
function handlerRegistry(): {
    any?: Record<string, unknown>;
    process?: Record<string, unknown>;
    anyDocs?: Record<string, string>;
    processDocs?: Record<string, string>;
    codeDocs?: Record<string, string>;
    meta?: HandlerMeta[];
} {
    const m = (globalThis as any).__mdHandlers;
    return {
        any: m?.ANY_HANDLERS,
        process: m?.PROCESS_HANDLERS,
        anyDocs: m?.ANY_HANDLER_DOCS,
        processDocs: m?.PROCESS_HANDLER_DOCS,
        codeDocs: m?.CODE_HANDLER_DOCS,
        meta: m?.HANDLER_META,
    };
}

/** `key — description` options from a registry, skipping unknown keys. */
function describedOptions(
    reg: Record<string, unknown> | undefined,
    docs: Record<string, string> | undefined,
    keys?: string[],
): Opt[] {
    if (!reg) return [];
    const names = keys ?? Object.keys(reg);
    return names
        .filter((k) => k in reg)
        .map((k) => {
            const doc = docs?.[k];
            return doc ? { value: k, label: `${k} — ${doc}` } : { value: k, label: k };
        });
}

/** Slot-scoped handler options from `HANDLER_META`, so a handler cannot appear in a slot that cannot use it. */
function slotHandlerKeys(slot: HandlerSlot, registry: "any" | "process" = "any"): Opt[] {
    const r = handlerRegistry();
    const metas = HANDLER_META.filter((m) => m.slots.includes(slot));
    if (metas.length === 0) return [];
    const reg = registry === "process" ? r.process : r.any;
    const docs = registry === "process" ? r.processDocs : r.anyDocs;
    // Fall back to a synthetic registry so options still render if the handler
    // module has not published its globals yet.
    const fallback = Object.fromEntries(metas.map((m) => [m.key, 1]));
    return describedOptions(reg ?? fallback, docs, metas.map((m) => m.key));
}

/** Projectile presets from `PROJECTILE_OPTIONS`, the compiler's own registry. A projectile is not a handler slot. */
export function listProjectileHandlerKeys(): Opt[] {
    const docs = PROJECTILE_OPTION_DOCS;
    return Object.keys(PROJECTILE_OPTIONS).sort().map((key) => ({
        value: key,
        label: key,
        desc: docs[key] ?? "Projectile options.",
    }));
}

export function listSignalHandlerKeys(): Opt[] {
    return slotHandlerKeys("signal");
}

export function listTriggerHandlerKeys(): Opt[] {
    return slotHandlerKeys("trigger");
}

export function listUpgradeHandlerKeys(): Opt[] {
    return slotHandlerKeys("upgrade");
}

/** `handleAction` callbacks for one `ItemType`. A Consumable yields none: `ActionType` has no such member. */
export function listItemActionHandlerKeys(itemType?: string): Opt[] {
    const metas = itemActionHandlersFor(itemType);
    const r = handlerRegistry();
    const docs = r.anyDocs;
    const fallback = Object.fromEntries(metas.map((m) => [m.key, 1]));
    return describedOptions(r.any ?? fallback, docs, metas.map((m) => m.key));
}

/** Processors, labelled with their descriptions. */
export function listDescribedProcessorKeys(): Opt[] {
    return slotHandlerKeys("processing", "process");
}

/** Description for one handler key, reading all three registries. */
export function handlerDoc(key: string): string | undefined {
    const r = handlerRegistry();
    return r.anyDocs?.[key] ?? r.processDocs?.[key] ?? r.codeDocs?.[key];
}

/**
 * Configured tech ids, for pickers that reference other tech nodes
 * (`requires`, `parentId`, tech-scoped handler parameters).
 *
 * `excludeSuffix` drops the node being edited: the form only holds the id
 * *suffix*, so a tech can never list itself as its own prerequisite.
 */
/** Unlock nodes, with the built-in "Unlock by default" first — it means available-from-start, not absent. */
export function listUnlockNodes(): Opt[] {
    return allUnlockNodes(loadConfig()).map((n) => ({
        value: n.id,
        label: n.kind === "always"
            ? `${n.name || n.id} — no research`
            : `${n.name || n.id} — research${n.cost === undefined ? "" : `, ${n.cost}`}`,
        source: n.id === DEFAULT_UNLOCK_NODE ? "mod" : "mod",
    }));
}

export function listTechIds(excludeSuffix?: string): Opt[] {
    const ex = excludeSuffix?.trim();
    return (loadConfig().techs ?? [])
        .filter((t) => {
            if (!t?.id) return false;
            // The form holds the id *suffix* ("mdmy.tech.tier2") while a stored id
            // is the full `${MOD_ID}:mdmy.tech.tier2`, so a plain endsWith on the
            // suffix is the match — not one on a ":" boundary.
            return ex ? t.id !== ex && !t.id.endsWith(ex) : true;
        })
        .map((t) => ({ value: t.id, label: t.name ? `${t.name} — ${t.id}` : t.id }));
}

/**
 * Branch ids already in use, so the picker offers what the config actually has.
 * `TechDefinition.branch` is a plain string in the engine — there is no branch
 * enum to read — so this is derived from our own techs plus a custom escape.
 */
/** Upgrade category ids. `registerCategory` is write-only, so game categories we never registered cannot be listed. */
export function listUpgradeCategoryIds(): Opt[] {
    const map = new Map<string, Opt>();
    // `tools` is the documented default and the field's own `def`. It is the
    // one game category worth naming, because an upgrade that forgets to set it
    // lands here.
    map.set("tools", { value: "tools", label: "tools (the game's default)", source: "game" });
    for (const c of loadConfig().upgradeCategories ?? []) {
        if (!c?.id) continue;
        map.set(c.id, {
            value: c.id,
            label: c.name ? `${c.name} (${c.id})` : `${c.id} (this mod)`,
            source: "mod",
        });
    }
    // The documented way through, for a category the game has and we cannot see.
    map.set("__custom__", {
        value: "__custom__",
        label: "custom category (the game may have more than we can list)",
    });
    return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
}

export function listTechBranches(): Opt[] {
    const seen = new Map<string, string>();
    for (const t of loadConfig().techs ?? []) {
        const b = typeof t?.branch === "string" ? t.branch.trim() : "";
        if (b) seen.set(b, b);
    }
    return [...seen.values()]
        .sort()
        .map((b) => ({ value: b, label: b }))
        .concat([{ value: "__custom__", label: "custom branch (type below)" }]);
}

/** Currency ids in use. A free string in the engine; `gold` is the documented example. */
export function listCurrencyTypes(): Opt[] {
    const seen = new Set<string>(["gold"]);
    for (const t of loadConfig().techs ?? []) {
        const c = typeof t?.currencyType === "string" ? t.currencyType.trim() : "";
        if (c) seen.add(c);
    }
    return [...seen]
        .sort()
        .map((c) => ({ value: c, label: c }))
        .concat([{ value: "__custom__", label: "custom currency (type below)" }]);
}

// ── Discovery: the game's own objects, as list rows ──────────────────────────

/**
 * One host object, as the list screen sees it.
 *
 * The list functions above answer "which ids can a picker offer". This answers a
 * different question — "what objects exist, and what does the engine know about
 * them" — and the extra part is the `native` definition. It is why a game row
 * is worth opening: the engine holds a registered element's density, matter type
 * and interaction list, which is not in this mod's config and cannot be derived
 * from it.
 *
 * `native` is genuinely optional rather than "always present". The host's
 * enumeration is uneven, and a row with an id and no definition is still a true
 * statement about the world. Hiding those rows would be worse than showing them
 * thinly.
 */
export interface NativeObject extends Omit<ListRow, "origin" | "entry"> {
    /**
     * Always `"game"`.
     *
     * Stated as a field rather than assumed by the caller so that the value is
     * visible where the object is built, and so `mergeRows` is handed rows that
     * already say what they are. A discovery function that could return a mod
     * row would be a category error — a mod row comes from the config, not from
     * the host's registry.
     */
    origin: "game";
}

/**
 * Add one discovered object to a map, stamping `origin: "game"`.
 *
 * Every discovery function builds its rows through this, so none of them can
 * forget the origin. That is not hypothetical: the origin is the one field the
 * whole screen branches on — it decides whether a row gets Edit and Del — so a
 * discovery function that omitted it would produce rows that look editable and
 * are not. A helper is cheaper to read than four repeated literals, and cheaper
 * still than one test per function.
 */
/** Live mod registries, read off `getSandkit()` — `api` is the raw host handle and has no `mods` on it. */
function modRegistry(): Record<string, Record<string, unknown>> {
    try {
        const s = getSandkit();
        return (s?.mods ?? s?.state?.sandkit?.mods ?? {}) as Record<
            string,
            Record<string, unknown>
        >;
    } catch {
        return {};
    }
}

function putNative(
    map: Map<string, NativeObject>,
    id: string,
    rest: Omit<NativeObject, "id" | "origin">,
): void {
    map.set(id, { id, origin: "game", ...rest });
}

/** A string worth showing, or `undefined` for blank/empty/non-string. */
function labelOf(v: unknown): string | undefined {
    return typeof v === "string" && v.trim() ? v : undefined;
}

/** Game elements with their raw definitions, hidden ones carried — the list screen filters them. */
export function discoverElements(): NativeObject[] {
    const out = new Map<string, NativeObject>();

    for (const t of skApi.elements.getRegisteredTypes()) {
        const def = skApi.elements.getDefinitionByType(t);
        const id = labelOf(def?.id) ?? skApi.elements.getIdByType(t);
        if (!id) continue;
        putNative(out, id, {
            label: labelOf(def?.name) ??
                skApi.elements.getNameByType(t) ??
                labelOf(def?.nameKey) ??
                id,
            color: colorFromMeta(def?.metaColor),
            // `visibleInPicker` is phrased as a positive — an element is hidden
            // when it says `false`, and the engine's own default is visible, so
            // absence here is *not* hidden. Routing it through `configIsHidden`
            // rather than testing it inline keeps this screen and the list
            // screen from disagreeing, which they did.
            hidden: configIsHidden(def ?? {}, "elements"),
            native: def,
        });
    }

    // The mod registry, for the flags the engine's own definitions omit.
    //
    // `getDefinitionByType` does not return `visibleInPicker` at all — it is not
    // on the engine's published `ElementDefinition`. The registry record is what
    // the registering mod wrote, so it carries the author's own flag, the same
    // way `hideFromBuildMenu` works for structures.
    //
    // Note what this is *not*: the engine never reads that field. It derives
    // picker visibility from matter type (`not Liquid and not Gas`) and only a
    // `vacuum:element:prepare` modifier can override that, which this mod does
    // not register. So `visibleInPicker` here is the mod author's local
    // convention, honoured by this UI and inert in game.
    for (const [id, entry] of Object.entries(modRegistry().elements ?? {})) {
        if (!id) continue;
        const reg = entry as Record<string, unknown>;
        const prior = out.get(id);
        out.set(id, {
            ...(prior ?? { id, origin: "game" as const, label: id }),
            label: labelOf(reg.name) ?? labelOf(reg.nameKey) ?? prior?.label ?? id,
            color: prior?.color ?? colorFromMeta(reg.metaColor),
            // Registry first, and the engine's copy only as a fallback: for an
            // element the engine's copy is always absent, so order decides
            // nothing today but keeps the rule sane if it ever appears.
            hidden: configIsHidden(reg, "elements") ||
                (configIsHidden(prior?.native ?? {}, "elements") &&
                    reg.visibleInPicker === undefined),
            native: { ...(prior?.native ?? {}), ...reg },
        });
    }

    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The display name of a built-in item, recovered from its `ItemId` enum value.
 *
 * `ItemId` is name→number and exposes no reverse map, so a built-in id *is* a
 * number: 2 is the grabber, 8 the rocket launcher. Nothing else on the definition
 * carries a name for it — `ItemDefinition` is typed with no `name` field at all —
 * so the member name is the only name there is, and without this the item screen
 * lists every built-in tool as a bare numeral.
 */
function builtInItemName(rawId: unknown): string | undefined {
    const n = typeof rawId === "number"
        ? rawId
        : typeof rawId === "string" && rawId.trim() !== "" && Number.isFinite(Number(rawId))
        ? Number(rawId)
        : undefined;
    if (n === undefined || !Number.isFinite(n)) return undefined;
    for (const member of enumNames("ItemId")) {
        if (enumValue("ItemId", member) === n) return humanise(member);
    }
    return undefined;
}

/** Game items, read via the documented `getRegisteredIds` + `getDefinitionById` pair. */
export function discoverItems(): NativeObject[] {
    const out = new Map<string, NativeObject>();
    for (const rawId of skApi.items.getRegisteredIds()) {
        if (rawId === null || rawId === undefined || rawId === "") continue;
        // A built-in id is a number, and was dropped here by a `typeof id !== "string"`
        // guard — so the game never actually had a name to show in the first place.
        const id = String(rawId);
        const def = skApi.items.getDefinitionById(String(rawId));
        out.set(id, {
            id,
            origin: "game",
            // A mod item carries its own `name`; a built-in one does not, and falls
            // through to the enum member name, and only then to the raw id.
            label: labelOf(def?.name) ?? builtInItemName(rawId) ?? id,
            native: def,
        });
    }
    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Game terrains. A `CellType` member name is not the id, so ids come from `getIdByType`. */
export function discoverTerrains(): NativeObject[] {
    const out = new Map<string, NativeObject>();
    for (const name of enumNames("CellType")) {
        const type = enumValue("CellType", name);
        if (type === undefined) continue;
        const id = skApi.terrains.getIdByType(type);
        if (!id || out.has(id)) continue;
        const def = skApi.terrains.getDefinitionByType(type);
        out.set(id, { id, origin: "game", label: labelOf(def?.name) ?? name, native: def });
    }
    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Game structures. The mod registry is read first: it is the only place `hideFromBuildMenu` is visible. */
export function discoverStructures(): NativeObject[] {
    const out = new Map<string, NativeObject>();

    // 1) The mod registry — carries the author's flags, keyed by id.
    for (const [id, entry] of Object.entries(modRegistry().structures ?? {})) {
        if (!id) continue;
        const def = entry as Record<string, unknown>;
        putNative(out, id, {
            label: labelOf(def?.name) ?? labelOf(def?.nameKey) ?? id,
            hidden: configIsHidden(def, "structures"),
            native: def,
        });
    }

    // 2) Everything else the engine offers — the base game's structures, which
    //    no mod registry will ever hold.
    for (const ref of [...skApi.structures.getAvailableTypes()]) {
        const def = skApi.structures.getDefinitionByType(ref);
        const id = labelOf(def?.id) ??
            (typeof ref === "string" ? ref : skApi.structures.getIdByType(ref));
        if (!id || out.has(id)) continue;
        putNative(out, id, {
            label: labelOf(def?.name) ?? labelOf(def?.nameKey) ?? id,
            // A base-game structure carries no mod flag, so this is normally
            // false — but reading it keeps one rule for every row.
            hidden: configIsHidden(def ?? {}, "structures"),
            native: def,
        });
    }

    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** The game's own sprites, by the ids the sprite registry holds. */
export function discoverSprites(): NativeObject[] {
    return listSpriteIds().map((o) => ({ id: o.value, origin: "game" as const, label: o.label }));
}

/** Hook-modifier handlers, from CODE_HANDLERS (used by the modifiers tab). */
export function listHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listHandlerKeys) {
            return m.listHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch { /* */ }
    return [
        { value: "logArgs", label: "logArgs" },
        { value: "identity", label: "identity" },
        { value: "signalLog", label: "signalLog" },
        { value: "triggerLog", label: "triggerLog" },
        { value: "noop", label: "noop" },
        { value: "defaultProjectileOptions", label: "defaultProjectileOptions" },
    ];
}
