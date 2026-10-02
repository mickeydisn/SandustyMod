/**
 * Subscribe to sandkit player-action events and feed the KPI buffer.
 *
 * ## One event per player action
 *
 * The engine emits the SAME logical action twice under two different ids:
 *
 * | action   | per-structure event | batch event          |
 * | -------- | ------------------- | -------------------- |
 * | place    | `building:placed`   | `structures:placed`  |
 * | demolish | `building:removed`  | `structures:removed` |
 * | move     | *(none)*            | `structures:moved`   |
 *
 * Subscribing to both columns double-counts every placement and demolition,
 * and a move additionally fires `structures:removed` with `byMove: true` — so
 * it would land in "removed" as well as "moved". We therefore use the
 * per-structure `building:*` events for place/remove (they carry the structure
 * type, so the breakdown is exact) and `structures:moved` for moves.
 *
 * `structures:placed` / `structures:removed` stay unsubscribed on purpose:
 * they are the world-commit side of the same action, not a second action.
 *
 * Item use is counted from the `action:intercept` hook, not from the
 * `item:used` event or the `item:use` hook — see `bindEvents` for why, and
 * `ENGINE_NOTES.md` §12.
 *
 * See `ENGINE_NOTES.md` for the emit sites these claims come from.
 */
import { api, root, safe } from "@sandmd/ui";
import { bumpKpi } from "./buffer.ts";
import { LOG } from "./constants.ts";

type Unsub = (() => void) | void;
const unsubs: Unsub[] = [];

function on(eventId: string, handler: (payload: any) => void): void {
    const u = safe(() => api.events.on(eventId, handler));
    if (typeof u === "function") unsubs.push(u as () => void);
}

/**
 * Subscribe to an engine **hook** (`api.hooks.intercept`) and keep the
 * unsubscribe so `unbindEvents` can take it back down.
 *
 * The runtime hands our handler `(payload, context)` and `context.cancel()`
 * vetoes the engine's default for that hook. A statistics mod must never
 * cancel — leave `context` untouched.
 *
 * Registration throws on a hook name the engine does not know, so it goes
 * through `safe` like everything else here: an unknown name then costs the
 * counter, never the mod.
 */
function onHook(hookId: string, handler: (payload: any, context?: any) => void): void {
    const u = safe(() => api.hooks?.intercept?.(hookId, handler));
    if (typeof u === "function") unsubs.push(u as () => void);
}

/** Best-effort display name for a numeric terrain cell type ("stone", "dirt"). */
function terrainName(cellType: unknown): string {
    if (typeof cellType === "string") return cellType;
    if (typeof cellType !== "number") return "unknown";
    const name = safe(() => api.terrains?.getIdByType?.(cellType) as string, "");
    return typeof name === "string" && name ? name : String(cellType);
}

/**
 * Structure type id. Structures carry their type in `.type`; `.id` is a
 * per-instance handle on some payloads, so `.type` is checked first.
 */
function structureIdOf(payload: any): string {
    const raw = payload?.structureType ?? payload?.structure?.type ??
        payload?.structureId ?? payload?.structure?.id ?? payload?.type;
    return raw == null ? "unknown" : String(raw);
}

/**
 * Turn a numeric structure or item type into the name a person would recognise.
 *
 * ## Why the panel shows bare numbers
 *
 * `building:placed` and `item:used` report a built-in's **type value** — a
 * number — because that is the engine's runtime handle. Terrain avoided this:
 * `terrainName` resolves `cellType` to an id at record time via
 * `api.terrains.getIdByType`, so a dug `12` is stored as `"Stone"`.
 *
 * Structures and items had no equivalent, so `String(12)` went into the buffer
 * and the panel listed "12" where a name belongs. `StructureType` and `ItemId`
 * are both name→number enums with no reverse map, so the member name is
 * recovered by scanning the enum, exactly as the catalog does.
 *
 * Resolution is at **display** time, not record time, on purpose: the counts
 * already in a player's buffer were stored as numbers, and resolving when the
 * event fires would leave every existing row still reading "12". Resolving here
 * fixes history as well as new events, and the raw key stays the row `id` so
 * graph series and selection keep working.
 *
 * A mod-registered structure or item has a string id, and that id *is* its
 * identity here — it is not run through the enum, so nothing is renamed.
 */

/** `api.enums.ItemId` under whichever name the host exposes it. */
function enumMap(name: string): Record<string, unknown> {
    const e = safe(() => (root as { enums?: Record<string, unknown> }).enums?.[name], null);
    return e && typeof e === "object" ? (e as Record<string, unknown>) : {};
}

/**
 * `ActionType.Building` — the numeric enum value, resolved from the host and
 * falling back to the hard-coded `2` (`Weapon=1, Building=2, Tool=3, Mod=4`).
 *
 * Read once at module load. `action:intercept` reports the active action, and a
 * structure placement rides the same signal as an item use; this is what lets
 * `src/events.ts` tell the two apart.
 */
const ACTION_TYPE_BUILDING = ((): number => {
    const n = safe(() => {
        const e = (root as { enums?: Record<string, unknown> }).enums;
        return (e?.ActionType as Record<string, unknown> | undefined)?.Building;
    }, undefined);
    return typeof n === "number" ? n : 2;
})();

/** `GrapplingHook` → `Grappling hook`; `ConveyorLeft` → `Conveyor left`. */
function humanise(k: string): string {
    const spaced = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The enum member name for a numeric value, or undefined if the enum has no such member. */
function memberNameFor(enumName: string, value: number): string | undefined {
    for (const [member, v] of Object.entries(enumMap(enumName))) {
        if (v === value) return member;
    }
    return undefined;
}

/** A built-in's registered name, when the host keeps one on the definition. */
function definedName(get: () => unknown): string | undefined {
    const n = safe(() => {
        const def = get() as { name?: unknown } | undefined;
        return typeof def?.name === "string" ? def.name : undefined;
    }, undefined);
    return typeof n === "string" && n.trim() ? n : undefined;
}

/**
 * A registered item's human name, from its **string** definition id.
 *
 * `item:use` reports `payload.itemId` = the item *definition* id, which is a
 * string (`"laser"`, `"drill"`, `"md-excavated-all:tool"`) — never the numeric
 * `ItemId` enum value. So the numeric branch in `displayNameFor` is only reached
 * by rows stored back when that was not yet true.
 *
 * Every registered definition, built-in or mod, carries a `nameKey`
 * (`"items|laser|name"`), so the game's own translation is the label. Two
 * failure modes are handled rather than guessed at:
 *
 * - the definition is gone (the owning mod was disabled), or the item was never
 *   registered — there is nothing to name it from, so `undefined` lets the
 *   caller keep the raw id;
 * - the `nameKey` has no translation — `i18n.t` echoes the key straight back,
 *   which would render as `items|laser|name`. That is not a name either.
 */
function itemNameFor(id: string): string | undefined {
    const def = safe(
        () => api.items?.getDefinitionById?.(id) as { nameKey?: unknown } | undefined,
        undefined,
    );
    const nameKey = def?.nameKey;
    if (typeof nameKey !== "string" || !nameKey) return undefined;

    const t = safe(() => api.i18n?.t?.(nameKey) as unknown, undefined);
    return typeof t === "string" && t.trim() && t !== nameKey ? t : undefined;
}

/**
 * A display name for one sub-key of a KPI category.
 *
 * Returns the key unchanged when nothing better is known, so an unresolvable id
 * still reads as itself rather than as a blank row or an invented name.
 */
export function displayNameFor(category: string, key: string): string {
    if (key.trim() === "") return key;
    const numeric = /^\d+$/.test(key);

    // Items are keyed by the string id the `item:use` hook reports, so they
    // resolve on the key itself. Everything else is keyed by number or is
    // already a name (terrain is resolved at record time).
    if (category === "items_used" && !numeric) return itemNameFor(key) ?? key;
    if (!numeric) return key;

    const n = Number(key);

    if (category.startsWith("structures_")) {
        return definedName(() => api.structures?.getDefinitionByType?.(n)) ??
            (() => {
                const m = memberNameFor("StructureType", n);
                return m ? humanise(m) : key;
            })();
    }

    if (category === "items_used") {
        // Rows written before the hook moved item keys to string ids. Still
        // resolved so existing history does not read as bare numbers.
        return definedName(() => api.items?.getDefinitionById?.(n)) ??
            (() => {
                const m = memberNameFor("ItemId", n);
                return m ? humanise(m) : key;
            })();
    }

    // Both projectile categories are keyed by `ProjectileType`, which is numeric
    // with no reverse map — the same shape as `ItemId`.
    if (category === "projectiles_hit" || category === "projectile_fire_structure") {
        const m = memberNameFor("ProjectileType", n);
        return m ? humanise(m) : key;
    }

    return key;
}

export function bindEvents(): void {
    // —— Structures placed (one event per structure) ——
    on("building:placed", (p) => {
        bumpKpi("structures_placed", structureIdOf(p));
    });

    // —— Structures demolished (one event per structure) ——
    on("building:removed", (p) => {
        bumpKpi("structures_removed", structureIdOf(p));
    });

    // —— Structures moved ——
    // `moved` entries are `{from, to}` cell records, not structures, so there
    // is no type to break down by; count the batch against the category total.
    on("structures:moved", (p) => {
        const n = Array.isArray(p?.moved) ? p.moved.length : 0;
        if (n > 0) bumpKpi("structures_moved", null, n);
    });

    // —— Item use ——
    //
    // Counted from the `action:intercept` hook — the action-start signal — read
    // as `args.action?.id`.
    //
    // Two earlier signals were tried and are both dead ends here:
    //
    // - `item:used` (event) is emitted from the use-*commit* only, which the
    //   engine reaches for a couple of built-ins and nothing else.
    // - `item:use` (hook) fires from *begin-use*, which is reached solely from
    //   the `ActionType.Mod` branch — so every built-in Weapon/Tool (vacuum,
    //   grabber, rocket launcher, grappling hook, …) never triggers it either.
    //
    // `action:intercept` fires on every action start — the mouse press that
    // begins an action — and carries the active action itself, so it covers
    // built-in and modded items alike:
    //
    //   runInterceptorsSafe(e, "action:intercept", {action, cellX, cellY})
    //
    // `action.id` is a numeric `ItemId` for built-ins and the definition id
    // string for a mod item; both resolve in `displayNameFor`.
    //
    // Not cancelling is required: the dispatch `return`s on a cancel, which
    // would eat the player's click.
    onHook("action:intercept", (args) => {
        const action = args?.action;
        const id = action?.id;
        if (typeof id !== "string" && typeof id !== "number") return;
        // A structure placement is an action too, but it is not an item use —
        // and `building:placed` already counts it, precisely. Leaving it in
        // would file conveyor types into the Items tab under an `ItemId` name.
        if (action?.type === ACTION_TYPE_BUILDING) return;
        bumpKpi("items_used", String(id));
    });

    // —— Projectile hits ——
    //
    // `projectile:hit` carries the live projectile record, so the breakdown is
    // by `projectile.type` (`ProjectileType`: Bullet, Rocket, GrapplingHook,
    // Fire, Digger, Mod).
    //
    // ⚠️ The dispatch short-circuits when an interceptor **cancels**, skipping
    // the hit itself. We only observe, so the default damage still lands.
    onHook("projectile:hit", (args) => {
        const type = args?.projectile?.type;
        if (typeof type !== "number") return;
        bumpKpi("projectiles_hit", String(type));
    });

    // —— Flamethrower fire over a structure ——
    //
    // Only `ProjectileType.Fire` reaches this one, and again the payload's
    // projectile record is the source of the type. Same no-cancel rule: a
    // cancel here would stop the fire from spreading.
    onHook("projectile:fire:overStructure", (args) => {
        const type = args?.projectile?.type;
        if (typeof type !== "number") return;
        bumpKpi("projectile_fire_structure", String(type));
    });

    // —— Terrain dig ——
    on("terrain:destroyed", (p) => {
        bumpKpi("terrain_destroyed", terrainName(p?.cellType ?? p?.type));
    });

    // —— World item pickup ——
    on("worldItem:pickedUp", (p) => {
        const t = p?.type ?? p?.worldItemId ?? "unknown";
        bumpKpi("world_items_picked", String(t));
    });

    // —— Resource collection ——
    on("resource:collected", (p) => {
        const id = p?.resourceId ?? "unknown";
        const amount = typeof p?.amount === "number" ? p.amount : 1;
        bumpKpi("resources_collected", String(id), amount);
    });

    console.log(
        `${LOG} tracking bound — 6 events + 4 hooks ` +
            `(action:intercept, projectile:hit, projectile:fire:overStructure, ` +
            `player:collision:prepare), ${unsubs.length} unsubs`,
    );
}

export function unbindEvents(): void {
    for (const u of unsubs) {
        try {
            u?.();
        } catch { /* */ }
    }
    unsubs.length = 0;
    console.log(`${LOG} event listeners unbound`);
}
