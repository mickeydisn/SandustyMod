/**
 * Worker entry — Sandustry simulation thread.
 * Build: deno task build:worker
 */
import "@sandmd/sandkit";
import { MOD_ID, VERSION } from "../config/ids.ts";
import { GridNear, runProfile } from "@sandmd/element-profiles";
import { ElementType } from "../shared/resolve.ts";
import { WaterCfg } from "./config.ts";
import { PROFILE_SPECS, profiles } from "../config/profileCatalogue.ts";

function dispatchSeed(
    x: number,
    y: number,
    elementType: number,
    cancel: any,
): boolean {
    if (!WaterCfg.modEnabled()) return false;

    for (const getProfile of Object.values(profiles)) {
        const profile = getProfile();
        if (profile.seedType == null || elementType !== profile.seedType) {
            continue;
        }
        if (
            profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)
        ) {
            continue;
        }

        // Reset physics so the seed can move, then run its profile.
        sandkit.api.elements.setPhysicsAtCell(x, y, 1);
        cancel.cancel();
        runProfile(x, y, profile);

        // Wake the seed's chunk and the cell above (next to fall).
        sandkit.api.grid.reportActivityAtCell(x, y);
        sandkit.api.grid.reportActivityAtCell(x, y - 1);
        return true;
    }

    sandkit.api.elements.setPhysicsAtCell(x, y, 0);
    return false;
}

try {
    // Seeds driven by the worker loop — one hook per distinct seedKey in specs.
    const seedKeys = [...new Set(PROFILE_SPECS.map((s) => s.seedKey))];
    const seedTypes = seedKeys.map((k) => ElementType[k]);

    for (const elementType of seedTypes) {
        if (!elementType) continue;
        sandkit.api.hooks.intercept(
            "element:update",
            (payload, cancel) => {
                try {
                    const p = payload as { x: number; y: number; elementType?: number };
                    return dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
                } catch (e) {
                    console.error('hooks.intercept("element:update")', e);
                }
            },
            { guard: { elementType } },
        );
    }
} catch (e) {
    console.error(`[${MOD_ID} v${VERSION}] update intercept failed:`, e);
}
