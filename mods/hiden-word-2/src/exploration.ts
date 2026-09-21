/**
 * Fog-of-war exploration layer (optional via params.explorationEnabled).
 *
 * explored[i] = 1 → visible / can materialize from
 * Initial: sky (empty, not fog-tunnel) is explored; everything else is not.
 */

import {
  EXPLORE_BORDER_PX,
  LOG,
  TERRAIN,
} from "./constants.ts";
import { runtime } from "./state.ts";

export function isExplorationEnabled(): boolean {
  return !!runtime.params?.explorationEnabled;
}

export function ensureExploredMask(force = false): void {
  const w = runtime.width;
  const h = runtime.height;
  if (w <= 0 || h <= 0) return;
  const n = w * h;
  if (!force && runtime.explored && runtime.explored.length === n) return;

  const mask = new Uint8Array(n);
  const data = runtime.data;
  if (data && data.length === n) {
    for (let i = 0; i < n; i++) {
      // Sky / empty (not fog-tunnel) starts explored
      if (data[i] === TERRAIN.SKY) mask[i] = 1;
    }
  }
  runtime.explored = mask;
  console.log(`${LOG} exploration mask ${w}×${h} (sky seeded)`);
}

/** Call after a full terrain regen. */
export function resetExplorationFromMap(): void {
  if (!isExplorationEnabled()) {
    runtime.explored = null;
    return;
  }
  ensureExploredMask(true);
}

export function isExplored(x: number, y: number): boolean {
  if (!isExplorationEnabled()) return true;
  const m = runtime.explored;
  if (!m) return false;
  const w = runtime.width;
  if (x < 0 || y < 0 || x >= w || y >= runtime.height) return false;
  return m[y * w + x] === 1;
}

/** Mark a disk explored (clamped). */
export function exploreDisk(cx: number, cy: number, radius: number): number {
  ensureExploredMask();
  const m = runtime.explored;
  if (!m) return 0;
  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (m[i] === 0) {
        m[i] = 1;
        n++;
      }
    }
  }
  return n;
}

/**
 * Explorer tool rule:
 *  - Brush must touch an already-explored cell (same gate as Manifest).
 *  - Only reveal: fog (tunnel), cells within border of fog,
 *    sky/empty, and cells within border of sky (explore outward from sky).
 * Returns how many newly explored cells (0 if not connected).
 */
export function exploreNearFog(cx: number, cy: number, radius: number): number {
  if (!isExplorationEnabled()) return 0;
  ensureExploredMask();
  const data = runtime.data;
  const m = runtime.explored;
  if (!data || !m) return 0;

  // Must touch existing exploration
  if (!materializeTouchesExplored(cx, cy, radius)) return -1;

  const w = runtime.width;
  const h = runtime.height;
  const border = EXPLORE_BORDER_PX;
  const r2 = radius * radius;
  let n = 0;

  const codeAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    return data[y * w + x]!;
  };

  const isFog = (x: number, y: number) => codeAt(x, y) === TERRAIN.TUNNEL;
  const isSky = (x: number, y: number) => codeAt(x, y) === TERRAIN.SKY;

  const nearType = (x: number, y: number, pred: (x: number, y: number) => boolean) => {
    if (pred(x, y)) return true;
    for (let dy = -border; dy <= border; dy++) {
      for (let dx = -border; dx <= border; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (pred(x + dx, y + dy)) return true;
      }
    }
    return false;
  };

  const eligible = (x: number, y: number) =>
    nearType(x, y, isFog) || nearType(x, y, isSky);

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!eligible(x, y)) continue;
      const i = y * w + x;
      if (m[i] === 0) {
        m[i] = 1;
        n++;
      }
    }
  }
  return n;
}

/**
 * Materializer gate: at least one cell in the brush that would place solid
 * (or any cell in the disk) must already be explored.
 */
export function materializeTouchesExplored(
  cx: number,
  cy: number,
  radius: number,
): boolean {
  if (!isExplorationEnabled()) return true;
  ensureExploredMask();
  const m = runtime.explored;
  if (!m) return false;
  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (m[y * w + x] === 1) return true;
    }
  }
  return false;
}

/** After materialize: explore the brush + EXPLORE_BORDER_PX around it. */
export function exploreMaterializeBorder(
  cx: number,
  cy: number,
  radius: number,
): number {
  if (!isExplorationEnabled()) return 0;
  return exploreDisk(cx, cy, radius + EXPLORE_BORDER_PX);
}

/** Apply exploration mask onto an ImageData (black out unexplored). */
export function applyExplorationToImageData(
  img: ImageData,
  pw: number,
  ph: number,
  mapW: number,
  mapH: number,
  div: number,
): void {
  if (!isExplorationEnabled()) return;
  const m = runtime.explored;
  if (!m) return;
  for (let py = 0; py < ph; py++) {
    const sy = Math.min(mapH - 1, py * div);
    for (let px = 0; px < pw; px++) {
      const sx = Math.min(mapW - 1, px * div);
      if (m[sy * mapW + sx] === 1) continue;
      const i = (py * pw + px) * 4;
      img.data[i] = 0;
      img.data[i + 1] = 0;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
}
