/**
 * Worker-thread builder — derives every seed profile from the ASTRO_ELEMENTS
 * catalogue, then installs the `element:update` hooks that drive the seeds.
 *
 * No config buffer: the profile definitions are baked in from the catalogue and
 * the lazy factories only read resolved type ids at `getProfile()` time.
 */
import { GridNear, runProfile } from "@sandmd/element-profiles";
import { ASTRO_ELEMENTS } from "../config/catalogue.ts";
import { MOD_ID, VERSION } from "../config/ids.ts";
import { ElementType } from "../shared/resolve.ts";
import type { AstroElementConfig } from "../element/types.ts";
import { createProfileFactories } from "./elementProfileFactory.ts";

const api = sandkit.api;

/** The shared cancel token the engine passes to intercept handlers. */
interface HookCancel {
    cancel: () => void;
}

// All seed profiles across the catalogue, keyed by profile id.
const profileFactories = createProfileFactories(
    (ASTRO_ELEMENTS as readonly AstroElementConfig<string>[]).flatMap(
        (el) => el.profiles ?? [],
    ),
);

/**
 * Run the first matching profile for a seed cell, or re-enable its fall physics.
 * Returns true when a profile ran (so the hook can cancel the vanilla update).
 */
function dispatchSeed(
    x: number,
    y: number,
    elementType: number,
    cancel: HookCancel,
): boolean {
    for (const getProfile of Object.values(profileFactories)) {
        const profile = getProfile();
        if (profile.seedType == null || elementType !== profile.seedType) continue;
        if (profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)) continue;

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
    const seedTypes = [...new Set(
        (ASTRO_ELEMENTS as readonly AstroElementConfig<string>[]).flatMap((el) =>
            (el.profiles ?? []).map((p) => ElementType[p.seedKey]),
        ),
    )];

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