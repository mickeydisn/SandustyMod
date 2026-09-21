import {
  EXPLORE_BORDER_PX,
  FALLBACK_CODE_COLORS,
  LOG,
  TERRAIN,
} from "./constants.ts";
import { runtime } from "./state.ts";

declare const sandkit: { api: any };

function liveApi(): any {
  try {
    return (sandkit as any).api;
  } catch {
    return null;
  }
}

/** Live grid: cell has solid terrain. */
export function isLiveTerrainAt(x: number, y: number): boolean {
  const a = liveApi();
  try {
    if (typeof a?.grid?.isTerrainAtCell === "function") {
      return a.grid.isTerrainAtCell(x, y) === true;
    }
  } catch { /* */ }
  return false;
}

/** Live grid: cell is empty (no terrain / element blocking). */
export function isLiveEmptyAt(x: number, y: number): boolean {
  const a = liveApi();
  try {
    if (typeof a?.grid?.isCellEmptyAtCell === "function") {
      return a.grid.isCellEmptyAtCell(x, y) === true;
    }
  } catch { /* */ }
  return true;
}

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

  if (!materializeTouchesExplored(cx, cy, radius)) return -1;

  const w = runtime.width;
  const h = runtime.height;
  const border = EXPLORE_BORDER_PX;
  const r = Math.max(0, radius | 0);
  const r2 = r * r;
  let n = 0;

  // Fast eligibility: cell is sky/fog OR within `border` of sky/fog (chebyshev).
  // Scan a slightly larger box once — no per-cell 5×5 loops.
  const x0 = Math.max(0, cx - r);
  const x1 = Math.min(w - 1, cx + r);
  const y0 = Math.max(0, cy - r);
  const y1 = Math.min(h - 1, cy + r);

  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const dy2 = dy * dy;
    const row = y * w;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy2 > r2) continue;
      const i = row + x;
      if (m[i] === 1) continue; // already explored

      // Hidden: sky / fog or within border of either
      let ok = false;
      const c = data[i]!;
      if (c === TERRAIN.SKY || c === TERRAIN.TUNNEL) {
        ok = true;
      } else {
        const bx0 = Math.max(0, x - border);
        const bx1 = Math.min(w - 1, x + border);
        const by0 = Math.max(0, y - border);
        const by1 = Math.min(h - 1, y + border);
        outer: for (let by = by0; by <= by1; by++) {
          const brow = by * w;
          for (let bx = bx0; bx <= bx1; bx++) {
            const bc = data[brow + bx]!;
            if (bc === TERRAIN.SKY || bc === TERRAIN.TUNNEL) {
              ok = true;
              break outer;
            }
          }
        }
      }
      if (!ok) continue;

      // Live: only non-terrain cells (reversed isTerrainAtCell)
      if (isLiveTerrainAt(x, y)) continue;

      m[i] = 1;
      n++;
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


/** Incremental update of the single ghost canvas (terrain + FoW). */
export function patchGhostRegion(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const canvas = runtime.cache;
  const data = runtime.data;
  if (!canvas || !data) return;
  const w = runtime.width;
  const h = runtime.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const left = Math.max(0, Math.min(x0, x1) | 0);
  const top = Math.max(0, Math.min(y0, y1) | 0);
  const right = Math.min(w - 1, Math.max(x0, x1) | 0);
  const bottom = Math.min(h - 1, Math.max(y0, y1) | 0);
  if (left > right || top > bottom) return;

  const pw = right - left + 1;
  const ph = bottom - top + 1;
  const mask = isExplorationEnabled() ? runtime.explored : null;
  const img = ctx.createImageData(pw, ph);

  for (let y = top; y <= bottom; y++) {
    const row = y * w;
    const py = y - top;
    for (let x = left; x <= right; x++) {
      const i = row + x;
      const o = (py * pw + (x - left)) * 4;
      if (mask && mask[i] === 0) {
        img.data[o] = 0;
        img.data[o + 1] = 0;
        img.data[o + 2] = 0;
        img.data[o + 3] = 255;
      } else {
        const rgba = FALLBACK_CODE_COLORS[data[i]!] ?? [0, 0, 0, 0];
        img.data[o] = rgba[0];
        img.data[o + 1] = rgba[1];
        img.data[o + 2] = rgba[2];
        img.data[o + 3] = rgba[3];
      }
    }
  }
  ctx.putImageData(img, left, top);
}
