/**
 * Generic worker-thread builder — drives a list of `Profile`s from the engine's
 * `element:update` hook.
 *
 * One hook is installed per distinct seed type. Each event is dispatched to the
 * first profile whose seed matches and which has its liquid nearby: that profile
 * gets the vanilla fall physics re-enabled at the cell, cancels the vanilla
 * update and runs its pipeline. Cells where no profile matches are returned to
 * normal physics.
 *
 * `sandkit.api` is read lazily inside the functions (never at module scope) so
 * merely importing this module is side-effect free.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/shared";
import type { Profile } from "../shared/types.ts";
import { resolveBoolean } from "../shared/num.ts";
import { runProfile } from "./pipeline.ts";
import { Grid } from "./utils/grid.ts";
import { GridNear } from "./utils/near.ts";

/** The shared cancel token the engine passes to intercept handlers. */
interface HookCancel {
    cancel: () => void;
}

export interface ElementWorkerResult {
    /** Distinct seed types that got an `element:update` hook. */
    seedTypes: TElementType[];
}

/** Run the first matching profile for a cell, else restore its vanilla physics. */
function dispatchSeed(
    x: number,
    y: number,
    elementType: number,
    cancel: HookCancel,
    profiles: readonly Profile[],
): boolean {
    const api = sandkit.api;
    for (const profile of profiles) {
        if (!profile.seedType || elementType !== profile.seedType) continue;
        if (!resolveBoolean(profile.enabled, true)) continue;
        if (!profile.liquidType || !GridNear.isNear(x, y, profile.liquidType)) continue;
        if (Grid.hasStructureAt(x, y)) continue;

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

/**
 * Install one `element:update` hook per distinct seed type in `profiles`.
 * Returns the hooked seed types (unresolved `0` types are skipped).
 */
export function buildElementWorker(profiles: readonly Profile[]): ElementWorkerResult {
    const api = sandkit.api;
    const seedTypes = [...new Set(profiles.map((p) => p.seedType))].filter((t) => !!t);

    for (const elementType of seedTypes) {
        api.hooks.intercept(
            "element:update",
            (payload, cancel) => {
                const p = payload as { x: number; y: number; elementType?: number };
                return dispatchSeed(p.x, p.y, p.elementType || 0, cancel as HookCancel, profiles);
            },
            { guard: { elementType } },
        );
    }

    return { seedTypes };
}
