/**
 * Worker-thread builder — installs the `element:update` hooks that drive the
 * seed profiles listed in `config/elementWorker`.
 *
 * No config buffer and no spec→Profile factory: the profiles are plain
 * `Profile` objects built with the real `Move`/`Grow`/`Crystallization`
 * actions, and this file only wires them to the engine.
 */
import { GridNear, runProfile } from "@sandmd/element-profiles";
import { ASTRO_PROFILES } from "../config/elementWorker/catalogue.ts";
import { MOD_ID, VERSION } from "../config/elementShared/ids.ts";

const api = sandkit.api;

/** The shared cancel token the engine passes to intercept handlers. */
interface HookCancel {
    cancel: () => void;
}

/**
 * Run the first matching profile for a seed cell, or re-enable its fall physics.
 * Returns true when a profile ran (so the hook can cancel the vanilla update).
 */
function dispatchSeed(x: number, y: number, elementType: number, cancel: HookCancel): boolean {
    for (const profile of ASTRO_PROFILES) {
        if (!profile.seedType || elementType !== profile.seedType) continue;
        if (!profile.liquidType || !GridNear.isNear(x, y, profile.liquidType)) continue;

        // Reset physics so the seed can move, then run its profile.
        api.elements.setPhysicsAtCell(x, y, 1);
        cancel.cancel();
        runProfile(x, y, profile);

        // Wake the seed's chunk and the cell above (next to fall).
        api.grid.reportActivityAtCell(x, y);
        api.grid.reportActivityAtCell(x, y - 1);
        return true;
    }

    api.elements.setPhysicsAtCell(x, y, 0);
    return false;
}

/** Install one `element:update` hook per distinct seed type in the catalogue. */
export function buildWorker(): void {
    const seedTypes = [...new Set(ASTRO_PROFILES.map((p) => p.seedType))];

    for (const elementType of seedTypes) {
        if (!elementType) continue;
        api.hooks.intercept(
            "element:update",
            (payload, cancel) => {
                const p = payload as { x: number; y: number; elementType?: number };
                return dispatchSeed(p.x, p.y, p.elementType || 0, cancel as HookCancel);
            },
            { guard: { elementType } },
        );
    }

    console.log(`[${MOD_ID} v${VERSION}] worker loaded`, seedTypes);
}
