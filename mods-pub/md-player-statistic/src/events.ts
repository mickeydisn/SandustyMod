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
 * A display name for one sub-key of a KPI category.
 *
 * Returns the key unchanged when nothing better is known, so an unresolvable id
 * still reads as itself rather than as a blank row or an invented name.
 */
export function displayNameFor(category: string, key: string): string {
    // A non-numeric key is already an id (a mod structure, a mod item, or a
    // terrain already resolved at record time) and is its own label.
    if (key.trim() === "" || !/^\d+$/.test(key)) return key;
    const n = Number(key);

    if (category.startsWith("structures_")) {
        return definedName(() => api.structures?.getDefinitionByType?.(n)) ??
            (() => {
                const m = memberNameFor("StructureType", n);
                return m ? humanise(m) : key;
            })();
    }

    if (category === "items_used") {
        return definedName(() => api.items?.getDefinitionById?.(n)) ??
            (() => {
                const m = memberNameFor("ItemId", n);
                return m ? humanise(m) : key;
            })();
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

    // —— Item use (vacuum, shoot, laser, dig tools, …) ——
    on("item:used", (p) => {
        const itemId = p?.itemId ?? p?.id ?? "unknown";
        bumpKpi("items_used", String(itemId));
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

    console.log(`${LOG} event listeners bound (${unsubs.length} unsubs)`);
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
