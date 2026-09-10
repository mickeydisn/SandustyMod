/**
 * Worker entry — Sandustry simulation thread.
 * Build: deno task build:worker
 */
import "@sandmd/sandkit";
import { MOD_ID, VERSION } from "../shared/ids.ts";
import { GridNear, runProfile } from "@sandmd/element-profiles";
import { profiles } from "./definition/profiles.ts";
import { ElementType } from "../shared/elements.ts";
import { WaterCfg } from "./definition/config.ts";

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
    const seedTypes = [
        ElementType.astroSeed,
        ElementType.astroGoldPowder,
        ElementType.astroCopperPowder,
    ];

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
