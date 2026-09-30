/**
 * Subscribe to sandkit player-action events and feed the KPI buffer.
 *
 * Tracked events (from https://sandustry.com/sandkit.html):
 *   building:placed / building:removed
 *   structures:placed / structures:removed / structures:moved
 *   item:used
 *   terrain:destroyed
 *   worldItem:pickedUp
 *   resource:collected
 */
import { api, safe } from "./api.ts";
import { bumpKpi } from "./buffer.ts";
import { LOG } from "./constants.ts";

type Unsub = (() => void) | void;
const unsubs: Unsub[] = [];

function on(eventId: string, handler: (payload: any) => void): void {
    const u = safe(() => api.events.on(eventId, handler));
    if (typeof u === "function") unsubs.push(u as () => void);
}

function structureIdOf(payload: any): string {
    return (
        payload?.structureId ??
        payload?.structure?.id ??
        payload?.structure?.type ??
        payload?.type ??
        "unknown"
    );
}

export function bindEvents(): void {
    // —— Structures place / remove / move ——
    on("building:placed", (p) => {
        bumpKpi("structures_placed", structureIdOf(p));
    });
    on("structures:placed", (p) => {
        const list = p?.structures;
        if (Array.isArray(list)) {
            for (const s of list) bumpKpi("structures_placed", structureIdOf({ structure: s }));
        } else {
            bumpKpi("structures_placed");
        }
    });
    on("building:removed", (p) => {
        bumpKpi("structures_removed", structureIdOf(p));
    });
    on("structures:removed", (p) => {
        const n = Array.isArray(p?.removed) ? p.removed.length : 1;
        // Prefer per-structure when available
        const list = p?.structures ?? p?.removed;
        if (Array.isArray(list) && list.length) {
            for (const s of list) bumpKpi("structures_removed", structureIdOf({ structure: s }));
        } else {
            bumpKpi("structures_removed", null, n);
        }
    });
    on("structures:moved", (p) => {
        const n = Array.isArray(p?.moved) ? p.moved.length : 1;
        if (Array.isArray(p?.moved) && p.moved.length) {
            for (const s of p.moved) bumpKpi("structures_moved", structureIdOf({ structure: s }));
        } else {
            bumpKpi("structures_moved", null, n);
        }
    });

    // —— Item use (vacuum, shoot, laser, dig tools, …) ——
    on("item:used", (p) => {
        const itemId = p?.itemId ?? p?.id ?? "unknown";
        bumpKpi("items_used", String(itemId));
    });

    // —— Terrain dig ——
    on("terrain:destroyed", (p) => {
        const cellType = p?.cellType ?? p?.type ?? "unknown";
        bumpKpi("terrain_destroyed", String(cellType));
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

    console.log(`${LOG} event listeners bound (${unsubs.length} unsubs tracked)`);
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
