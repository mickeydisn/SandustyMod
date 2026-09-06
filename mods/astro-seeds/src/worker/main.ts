/**
 * Worker entry — Sandustry simulation thread.
 * Build: deno task build:worker
 */

import { MOD_ID, VERSION } from "../shared/ids.ts";
import { WaterCfg } from "./definition/config.ts";

import { runProfile } from "./pipeline.ts";

import { profiles } from "./definition/profiles.ts";
import { GridNear } from "./utils/gridnear.ts";
import { ElementTypeInWorker as ElementType } from "./elementResolve.ts";

function dispatchSeed(
  x: number,
  y: number,
  elementType: number,
  c: any,
): boolean {
  if (!WaterCfg.modEnabled()) return false;

  for (const getProfile of Object.values(profiles)) {
    const profile = getProfile();
    if (profile.seedType == null || elementType != profile.seedType) {
      continue;
    }
    if (
      profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)
    ) {
      continue;
    }

    // Reset physics for the seed cell to ensure it can move
    sandkit.api.elements.setPhysicsAtCell(x, y, 1);
    // Cancel the default behavior of the seed update to allow custom logic
    c.cancel();
    // Run the profile for the seed at the specified coordinates
    runProfile(x, y, profile);

    // Active Near Cell
    sandkit.api.grid.reportActivityAtCell(x, y); // wake the seed's chunk
    sandkit.api.grid.reportActivityAtCell(x, y - 1); // wake the cell ABOVE (next to fall)

    return true;
  }
  sandkit.api.elements.setPhysicsAtCell(x, y, 0);
  return false;
}
try {
  // sandkit.api.events.on(
  //	"element:moved",
  //	(payload) => {
  sandkit.api.hooks.intercept(
    "element:update",
    (payload, cancel) => {
      try {
        const p = payload as { x: number; y: number; elementType?: number };
        const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
        return isDispatch;
      } catch (e) {
        console.error('hooks.intercept("element:updated")', e);
      }
    },
    { guard: { elementType: ElementType.astroSeed } },
  );

  sandkit.api.hooks.intercept(
    "element:update",
    (payload, cancel) => {
      try {
        const p = payload as { x: number; y: number; elementType?: number };
        const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
        return isDispatch;
      } catch (e) {
        console.error('hooks.intercept("element:updated")', e);
      }
    },
    { guard: { elementType: ElementType.astroGoldPowder } },
  );

  sandkit.api.hooks.intercept(
    "element:update",
    (payload, cancel) => {
      try {
        const p = payload as { x: number; y: number; elementType?: number };
        const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
        return isDispatch;
      } catch (e) {
        console.error('hooks.intercept("element:updated")', e);
      }
    },
    { guard: { elementType: ElementType.astroCopperPowder } },
  );
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] moved failed:`, e);
}
