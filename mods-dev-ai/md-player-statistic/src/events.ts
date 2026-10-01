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
import { api, safe } from "@sandmd/ui";
import { bumpKpi } from "./buffer.ts";
import { LOG } from "./constants.ts";
import { bindGrabber, unbindGrabber } from "./graber.ts";

type Unsub = (() => void) | void;
const unsubs: Unsub[] = [];
/** `api.hooks.*` unsubscribes, released alongside the event listeners. */
const hookUnsubs: Unsub[] = [];

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

    // —— Grabber (uses + per-resource), driven by api.hooks ——
    bindGrabber(on, (unsub) => {
        hookUnsubs.push(unsub);
    });

    console.log(
        `${LOG} event listeners bound (${unsubs.length} unsubs, ` +
            `${hookUnsubs.length} hook unsubs tracked)`,
    );
}

export function unbindEvents(): void {
    unbindGrabber();
    for (const u of unsubs) {
        try {
            u?.();
        } catch { /* */ }
    }
    unsubs.length = 0;
    for (const u of hookUnsubs) {
        try {
            u?.();
        } catch { /* */ }
    }
    hookUnsubs.length = 0;
    console.log(`${LOG} event listeners unbound`);
}
