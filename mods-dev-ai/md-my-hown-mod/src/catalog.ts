





import { getSandkit, safe } from "./api.ts";
import { api as skApi } from "./packages/mysandkit.ts";
import { configIsHidden, humanise } from "./constants.ts";
import { configStore } from "./config/store.ts";
import type { ListRow } from "./ui/definition/types.ts";
import { allUnlockNodes, DEFAULT_UNLOCK_NODE } from "./ui/tech-link.ts";

export type Opt = {
    value: string;
    label: string;
    color?: string;
    source?: "game" | "mod";
    
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


function enumNames(name: string): string[] {
    const e = sk()?.enums?.[name];
    if (!e || typeof e !== "object") return [];
    return Object.keys(e).filter((k) => Number.isNaN(Number(k))).sort();
}


function enumValue(enumName: string, member: string): number | undefined {
    const v = enumRawValue(enumName, member);
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}


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


export function listElements(opts?: { includeHidden?: boolean }): Opt[] {
    const map = new Map<string, Opt>();
    const includeHidden = !!opts?.includeHidden;
    
    
    
    const hidden = new Set<string>();

    
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
        
        
        const id = def?.id ?? skApi.elements.getIdByType(t);
        if (!id) continue;
        if (def?.hidden === true) {
            hidden.add(String(id));
            
            
            
            if (!includeHidden) continue;
        }
        const name = def?.name ?? skApi.elements.getNameByType(t) ?? def?.nameKey ??
            id;
        map.set(String(id), {
            value: String(id),
            label: String(name),
            color: colorFromMeta(def?.metaColor),
            source: "game",
            
            hidden: def?.hidden === true,
        });
    }

    
    
    
    for (const name of enumNames("ElementType")) {
        const type = enumValue("ElementType", name);
        if (type === undefined) continue;
        const id = skApi.elements.getIdByType(type);
        if (!id || map.has(String(id))) continue;
        if (hidden.has(String(id))) continue;
        map.set(String(id), { value: String(id), label: name, source: "game" });
    }

    
    for (const el of configStore.load().elements ?? []) {
        if (!el?.id) continue;
        map.set(el.id, {
            value: el.id,
            label: `${el.name || el.id} (this mod)`,
            source: "mod",
            color: typeof el.metaColor === "string" ? el.metaColor : colorFromMeta(el.metaColor),
            
            
            hidden: el.hidden === true,
        });
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}


const DEFAULT_ENERGY_NETWORK = "power";

export function listEnergyNetworkOpts(): Opt[] {
    const map = new Map<string, Opt>();
    map.set(DEFAULT_ENERGY_NETWORK, {
        value: DEFAULT_ENERGY_NETWORK,
        label: `${DEFAULT_ENERGY_NETWORK} — the game's own network`,
    });
    for (const n of configStore.load().energyNetworks ?? []) {
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
            
            if (typeof t === "string" && t) {
                if (map.has(t)) continue;
                const def = skApi.structures.getDefinitionByType(t);
                map.set(t, {
                    value: t,
                    label: String(def?.name ?? def?.nameKey ?? t),
                    source: "game",
                    
                    
                    
                    
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
            
            
            
            map.set(name, { value: name, label: o.label, source: "game" });
        }
    }

    for (const st of configStore.load().structures ?? []) {
        if (st?.id) {
            map.set(st.id, {
                value: st.id,
                label: `${st.name || st.id} (this mod)`,
                source: "mod",
                
                
                
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
    
    
    
    
    
    
    
    
    for (const name of enumNames("ItemId")) {
        const v = enumRawValue("ItemId", name);
        if (typeof v !== "string" || !v) continue;
        if (map.has(v)) continue;
        
        
        
        map.set(v, { value: v, label: v, source: "game" });
    }
    for (const it of configStore.load().items ?? []) {
        if (!it?.id) continue;
        map.set(it.id, { value: it.id, label: `${it.name || it.id} (this mod)`, source: "mod" });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}


export function listTerrains(): Opt[] {
    const map = new Map<string, Opt>();

    for (const name of enumNames("CellType")) {
        const type = enumValue("CellType", name);
        if (type === undefined) continue;
        const id = skApi.terrains.getIdByType(type);
        if (!id || map.has(String(id))) continue;
        map.set(String(id), { value: String(id), label: name, source: "game" });
    }

    for (const t of configStore.load().terrains ?? []) {
        if (!t?.id) continue;
        map.set(t.id, { value: t.id, label: `${t.name || t.id} (this mod)`, source: "mod" });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}


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


export function listMaterialIds(): Opt[] {
    const used = (configStore.load().terrains ?? [])
        .map((t) => Number((t as { materialId?: unknown } | undefined)?.materialId))
        .filter((n) => Number.isFinite(n));
    const taken = new Set(used);

    
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


export interface DrawFnMeta {
    key: string;
    label: string;
    
    doc: string;
    
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


export function listDrawFunctions(): Opt[] {
    return DRAW_FUNCTIONS.map((d) => ({ value: d.key, label: `${d.label} — ${d.doc}` }));
}


export function listMatterTypes(): Opt[] {
    
    
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


const KEY_CODE_SUGGESTIONS = [
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


export function listContactOrientation(): Opt[] {
    return [
        { value: "any", label: "any — touch in any arrangement" },
        { value: "stacked", label: "stacked — vertical only" },
    ];
}


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
    
    
    for (const sp of configStore.load().sprites ?? []) {
        if (!sp?.id) continue;
        const lib = LIBRARY_ICONS.find((i) => i.path === sp.path);
        
        
        
        
        
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



export interface LibraryAsset {

    name: string;
    
    path: string;
    
    sizes: string[];
    
    preview: string;
    
    previewW: number;
    previewH: number;
}

import { LIBRARY_ICONS } from "./generated/sprite-library.ts";
export { LIBRARY_ICONS };


function listLibraryAssets(): LibraryAsset[] {
    return [...LIBRARY_ICONS].sort((a, b) => a.name.localeCompare(b.name));
}


export function searchLibraryAssets(query: string): LibraryAsset[] {
    const q = query.trim().toLowerCase();
    const all = listLibraryAssets();
    if (!q) return all;
    return all.filter((i) => i.name.toLowerCase().includes(q));
}


export function listOutputTargets(): Opt[] {
    return [{ value: "__null__", label: "∅ consume (null)" }, ...listElements()];
}


export function listAnyHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listAnyHandlerKeys) {
            return m.listAnyHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch {  }
    return listHandlerKeys();
}


export function listProcessorKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listProcessorKeys) {
            return m.listProcessorKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch {  }
    return [{ value: "processorLog", label: "processorLog" }, {
        value: "processorNoop",
        label: "processorNoop",
    }];
}








/**
 * The action docs published on `__mdHandlers` by the handler package.
 *
 * The bridge sets all three names to the same table, so the fallbacks are
 * belt-and-braces for an older handler build rather than three sources. The
 * `ANY_HANDLERS` / `PROCESS_HANDLERS` / `HANDLER_META` fields this used to
 * surface were never set by the bridge, so they were always undefined.
 */
function handlerDocs(): Record<string, string> | undefined {
    const m = (globalThis as any).__mdHandlers;
    return m?.ANY_HANDLER_DOCS ?? m?.PROCESS_HANDLER_DOCS ?? m?.CODE_HANDLER_DOCS;
}

export function handlerDoc(key: string): string | undefined {
    return handlerDocs()?.[key];
}



export function listUnlockNodes(): Opt[] {
    return allUnlockNodes(configStore.load()).map((n) => ({
        value: n.id,
        label: n.kind === "always"
            ? `${n.name || n.id} — no research`
            : `${n.name || n.id} — research${n.cost === undefined ? "" : `, ${n.cost}`}`,
        source: n.id === DEFAULT_UNLOCK_NODE ? "mod" : "mod",
    }));
}

export function listTechIds(excludeSuffix?: string): Opt[] {
    const ex = excludeSuffix?.trim();
    return (configStore.load().techs ?? [])
        .filter((t) => {
            if (!t?.id) return false;
            
            
            
            return ex ? t.id !== ex && !t.id.endsWith(ex) : true;
        })
        .map((t) => ({ value: t.id, label: t.name ? `${t.name} — ${t.id}` : t.id }));
}



export function listUpgradeCategoryIds(): Opt[] {
    const map = new Map<string, Opt>();
    
    
    
    map.set("tools", { value: "tools", label: "tools (the game's default)", source: "game" });
    for (const c of configStore.load().upgradeCategories ?? []) {
        if (!c?.id) continue;
        map.set(c.id, {
            value: c.id,
            label: c.name ? `${c.name} (${c.id})` : `${c.id} (this mod)`,
            source: "mod",
        });
    }
    
    map.set("__custom__", {
        value: "__custom__",
        label: "custom category (the game may have more than we can list)",
    });
    return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
}

export function listTechBranches(): Opt[] {
    const seen = new Map<string, string>();
    for (const t of configStore.load().techs ?? []) {
        const b = typeof t?.branch === "string" ? t.branch.trim() : "";
        if (b) seen.set(b, b);
    }
    return [...seen.values()]
        .sort()
        .map((b) => ({ value: b, label: b }))
        .concat([{ value: "__custom__", label: "custom branch (type below)" }]);
}


export function listCurrencyTypes(): Opt[] {
    const seen = new Set<string>(["gold"]);
    for (const t of configStore.load().techs ?? []) {
        const c = typeof t?.currencyType === "string" ? t.currencyType.trim() : "";
        if (c) seen.add(c);
    }
    return [...seen]
        .sort()
        .map((c) => ({ value: c, label: c }))
        .concat([{ value: "__custom__", label: "custom currency (type below)" }]);
}




export interface NativeObject extends Omit<ListRow, "origin" | "entry"> {
    
    origin: "game";
}



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


function labelOf(v: unknown): string | undefined {
    return typeof v === "string" && v.trim() ? v : undefined;
}


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
            
            
            
            
            
            hidden: configIsHidden(def ?? {}, "elements"),
            native: def,
        });
    }

    
    
    
    
    
    
    
    
    
    
    
    
    for (const [id, entry] of Object.entries(modRegistry().elements ?? {})) {
        if (!id) continue;
        const reg = entry as Record<string, unknown>;
        const prior = out.get(id);
        out.set(id, {
            ...(prior ?? { id, origin: "game" as const, label: id }),
            label: labelOf(reg.name) ?? labelOf(reg.nameKey) ?? prior?.label ?? id,
            color: prior?.color ?? colorFromMeta(reg.metaColor),
            
            
            
            hidden: configIsHidden(reg, "elements") ||
                (configIsHidden(prior?.native ?? {}, "elements") &&
                    reg.visibleInPicker === undefined),
            native: { ...(prior?.native ?? {}), ...reg },
        });
    }

    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}


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


export function discoverItems(): NativeObject[] {
    const out = new Map<string, NativeObject>();
    for (const rawId of skApi.items.getRegisteredIds()) {
        if (rawId === null || rawId === undefined || rawId === "") continue;
        
        
        const id = String(rawId);
        const def = skApi.items.getDefinitionById(String(rawId));
        out.set(id, {
            id,
            origin: "game",
            
            
            label: labelOf(def?.name) ?? builtInItemName(rawId) ?? id,
            native: def,
        });
    }
    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}


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


export function discoverStructures(): NativeObject[] {
    const out = new Map<string, NativeObject>();

    
    for (const [id, entry] of Object.entries(modRegistry().structures ?? {})) {
        if (!id) continue;
        const def = entry as Record<string, unknown>;
        putNative(out, id, {
            label: labelOf(def?.name) ?? labelOf(def?.nameKey) ?? id,
            hidden: configIsHidden(def, "structures"),
            native: def,
        });
    }

    
    
    for (const ref of [...skApi.structures.getAvailableTypes()]) {
        const def = skApi.structures.getDefinitionByType(ref);
        const id = labelOf(def?.id) ??
            (typeof ref === "string" ? ref : skApi.structures.getIdByType(ref));
        if (!id || out.has(id)) continue;
        putNative(out, id, {
            label: labelOf(def?.name) ?? labelOf(def?.nameKey) ?? id,
            
            
            hidden: configIsHidden(def ?? {}, "structures"),
            native: def,
        });
    }

    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}


export function listHandlerKeys(): Opt[] {
    try {
        const m = (globalThis as any).__mdHandlers;
        if (m?.listHandlerKeys) {
            return m.listHandlerKeys().map((k: string) => ({ value: k, label: k }));
        }
    } catch {  }
    return [
        { value: "logArgs", label: "logArgs" },
        { value: "identity", label: "identity" },
        { value: "signalLog", label: "signalLog" },
        { value: "triggerLog", label: "triggerLog" },
        { value: "noop", label: "noop" },
        { value: "defaultProjectileOptions", label: "defaultProjectileOptions" },
    ];
}
