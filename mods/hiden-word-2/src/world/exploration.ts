/** Compatibility aliases — prefer importing from ./tags.ts */
export {
  isTagsEnabled as isExplorationEnabled,
  resetTagsFromMap as resetExplorationFromMap,
  patchGhostRegion,
  touchesMaterialised as materializeTouchesExplored,
  ensureTags as ensureExploredMask,
} from "./tags.ts";

import { tagAfterMaterialize } from "./tags.ts";

export function exploreMaterializeBorder(
  cx: number,
  cy: number,
  radius: number,
): number {
  const cells: { x: number; y: number }[] = [];
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      cells.push({ x: cx + dx, y: cy + dy });
    }
  }
  return tagAfterMaterialize(cells);
}
