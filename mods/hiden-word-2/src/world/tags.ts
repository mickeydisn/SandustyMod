/**
 * Hidden-world cell tags: Hidden → Explored → Materialised
 *
 * On generate: sky = Materialised, everything else = Hidden.
 */

import { EXPLORE_BORDER_PX, FALLBACK_CODE_COLORS, LOG, TERRAIN } from "./constants.ts";
import { runtime } from "./state.ts";

declare const sandkit: { api: any };

function isLiveEmptyCell(x: number, y: number): boolean {
  try {
    const a = (sandkit as any).api;
    if (typeof a?.grid?.isCellEmptyAtCell === "function") {
      return a.grid.isCellEmptyAtCell(x, y) === true;
    }
    // fallback: treat as blocked if terrain present
    if (typeof a?.grid?.isTerrainAtCell === "function") {
      return a.grid.isTerrainAtCell(x, y) !== true;
    }
  } catch { /* */ }
  return true;
}

export const TAG = {
  HIDDEN: 0,
  EXPLORED: 1,
  MATERIALISED: 2,
} as const;

export type TagValue = (typeof TAG)[keyof typeof TAG];

/**
 * Tag overlays on terrain (except sky):
 *  Hidden      — full black (map hidden)
 *  Explored    — red @ 50% over terrain
 *  Materialised— blue @ 50% over terrain
 * Fog terrain base alpha = 15%.
 */
export const TAG_OVERLAY = {
  /** Explored on solid terrain: black @ 20% */
  exploredSolid: [0, 0, 0] as const,
  exploredSolidAlpha: 0.2,
  /** Explored on fog: red @ 70% */
  exploredFog: [255, 40, 40] as const,
  exploredFogAlpha: 0.7,
  /** Materialised: blue @ 30% */
  materialised: [40, 120, 255] as const,
  materialisedAlpha: 0.3,
  /** Fog base: black @ 40% */
  fogRgb: [0, 0, 0] as const,
  fogAlpha: 0.4,
};


export type RgbaOut = [number, number, number, number];

/** Composite one cell for the ghost canvas. */
export function compositeTagPixel(
  code: number,
  tag: number,
  baseRgba: RgbaOut,
  tagsOn: boolean,
): RgbaOut {
  // Sky: no tag overlay, stay transparent
  if (code === TERRAIN.SKY) {
    return [baseRgba[0], baseRgba[1], baseRgba[2], baseRgba[3]];
  }

  if (tagsOn && tag === TAG.HIDDEN) {
    return [0, 0, 0, 255];
  }

  let r = baseRgba[0];
  let g = baseRgba[1];
  let b = baseRgba[2];
  let a = baseRgba[3] < 16 ? 255 : baseRgba[3];

  // Fog base: black @ 40%
  if (code === TERRAIN.TUNNEL) {
    r = TAG_OVERLAY.fogRgb[0];
    g = TAG_OVERLAY.fogRgb[1];
    b = TAG_OVERLAY.fogRgb[2];
    a = Math.round(255 * TAG_OVERLAY.fogAlpha);
  }

  if (!tagsOn) {
    return [r, g, b, a];
  }

  if (tag === TAG.EXPLORED) {
    // % = tint mix into RGB — do NOT crush pixel alpha or stone/dirt look identical
    const onFog = code === TERRAIN.TUNNEL;
    const oa = onFog ? TAG_OVERLAY.exploredFogAlpha : TAG_OVERLAY.exploredSolidAlpha;
    const ia = 1 - oa;
    const [or, og, ob] = onFog ? TAG_OVERLAY.exploredFog : TAG_OVERLAY.exploredSolid;
    r = Math.round(r * ia + or * oa);
    g = Math.round(g * ia + og * oa);
    b = Math.round(b * ia + ob * oa);
    if (onFog) {
      a = Math.round(255 * TAG_OVERLAY.fogAlpha);
    } else {
      a = 255; // full alpha so terrain hues stay distinct under the light tint
    }
  } else if (tag === TAG.MATERIALISED) {
    const oa = TAG_OVERLAY.materialisedAlpha;
    const ia = 1 - oa;
    const [or, og, ob] = TAG_OVERLAY.materialised;
    r = Math.round(r * ia + or * oa);
    g = Math.round(g * ia + og * oa);
    b = Math.round(b * ia + ob * oa);
    a = code === TERRAIN.TUNNEL
      ? Math.round(255 * TAG_OVERLAY.fogAlpha)
      : 255;
  }

  return [r, g, b, a];
}

export function isTagsEnabled(): boolean {
  return !!runtime.params?.explorationEnabled;
}

export function ensureTags(force = false): void {
  const w = runtime.width;
  const h = runtime.height;
  if (w <= 0 || h <= 0) return;
  const n = w * h;
  if (!force && runtime.tags && runtime.tags.length === n) return;

  const tags = new Uint8Array(n);
  const data = runtime.data;
  if (data && data.length === n) {
    for (let i = 0; i < n; i++) {
      tags[i] = data[i] === TERRAIN.SKY ? TAG.MATERIALISED : TAG.HIDDEN;
    }
  }
  runtime.tags = tags;
  // keep legacy alias in sync for any leftover readers
  runtime.explored = tags;
  console.log(`${LOG} tags ${w}×${h} (sky=materialised)`);
}

export function resetTagsFromMap(): void {
  if (!isTagsEnabled()) {
    runtime.tags = null;
    runtime.explored = null;
    return;
  }
  ensureTags(true);
}

export function tagAt(x: number, y: number): TagValue {
  if (!isTagsEnabled()) return TAG.MATERIALISED;
  const t = runtime.tags;
  if (!t) return TAG.HIDDEN;
  const w = runtime.width;
  if (x < 0 || y < 0 || x >= w || y >= runtime.height) return TAG.HIDDEN;
  return t[y * w + x]! as TagValue;
}

export function isVisibleTag(tag: number): boolean {
  return tag === TAG.EXPLORED || tag === TAG.MATERIALISED;
}

/** Brush touches at least one Materialised cell. */
export function touchesMaterialised(
  cx: number,
  cy: number,
  radius: number,
): boolean {
  if (!isTagsEnabled()) return true;
  ensureTags();
  const t = runtime.tags;
  if (!t) return false;
  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (t[y * w + x] === TAG.MATERIALISED) return true;
    }
  }
  return false;
}

function setTag(i: number, value: TagValue, tags: Uint8Array): boolean {
  const cur = tags[i]!;
  if (value <= cur) return false; // never downgrade
  tags[i] = value;
  return true;
}

function markBorderExplored(
  x: number,
  y: number,
  border: number,
  tags: Uint8Array,
  w: number,
  h: number,
): number {
  let n = 0;
  for (let dy = -border; dy <= border; dy++) {
    for (let dx = -border; dx <= border; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!isLiveEmptyCell(nx, ny)) continue;
      if (setTag(ny * w + nx, TAG.EXPLORED, tags)) n++;
    }
  }
  return n;
}

/**
 * Fog Explorer: must touch Materialised.
 * Fog cells → Materialised; 2px around fog/sky → Explored.
 */
export function applyFogExplorer(
  cx: number,
  cy: number,
  radius: number,
): { materialised: number; explored: number; blocked: boolean } {
  if (!isTagsEnabled()) return { materialised: 0, explored: 0, blocked: false };
  ensureTags();
  const data = runtime.data;
  const tags = runtime.tags;
  if (!data || !tags) return { materialised: 0, explored: 0, blocked: true };

  if (!touchesMaterialised(cx, cy, radius)) {
    return { materialised: 0, explored: 0, blocked: true };
  }

  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  const border = EXPLORE_BORDER_PX;
  let materialised = 0;
  let explored = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      // Same gate as Manifest: no work where live terrain already exists
      if (!isLiveEmptyCell(x, y)) continue;
      const i = y * w + x;
      const code = data[i]!;

      if (code === TERRAIN.TUNNEL) {
        if (setTag(i, TAG.MATERIALISED, tags)) materialised++;
        explored += markBorderExplored(x, y, border, tags, w, h);
      } else if (code === TERRAIN.SKY) {
        explored += markBorderExplored(x, y, border, tags, w, h);
      } else {
        let near = false;
        for (let by = -border; by <= border && !near; by++) {
          for (let bx = -border; bx <= border && !near; bx++) {
            const nx = x + bx;
            const ny = y + by;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const c = data[ny * w + nx]!;
            if (c === TERRAIN.TUNNEL || c === TERRAIN.SKY) near = true;
          }
        }
        if (near && setTag(i, TAG.EXPLORED, tags)) explored++;
      }
    }
  }
  return { materialised, explored, blocked: false };
}

/**
 * Deep Fog Explorer: no Materialised contact required.
 * Fog → Explored only (not Materialised); 2px border → Explored.
 */
export function applyDeepFogExplorer(
  cx: number,
  cy: number,
  radius: number,
): { explored: number } {
  if (!isTagsEnabled()) return { explored: 0 };
  ensureTags();
  const data = runtime.data;
  const tags = runtime.tags;
  if (!data || !tags) return { explored: 0 };

  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  const border = EXPLORE_BORDER_PX;
  let explored = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!isLiveEmptyCell(x, y)) continue;
      const i = y * w + x;
      const code = data[i]!;

      if (code === TERRAIN.TUNNEL || code === TERRAIN.SKY) {
        if (setTag(i, TAG.EXPLORED, tags)) explored++;
        explored += markBorderExplored(x, y, border, tags, w, h);
      } else {
        let near = false;
        for (let by = -border; by <= border && !near; by++) {
          for (let bx = -border; bx <= border && !near; bx++) {
            const nx = x + bx;
            const ny = y + by;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const c = data[ny * w + nx]!;
            if (c === TERRAIN.TUNNEL || c === TERRAIN.SKY) near = true;
          }
        }
        if (near && setTag(i, TAG.EXPLORED, tags)) explored++;
      }
    }
  }
  return { explored };
}

/** After World Manifest places cells: centre → Materialised, border → Explored. */
export function tagAfterMaterialize(
  cells: { x: number; y: number }[],
  border = EXPLORE_BORDER_PX,
): number {
  if (!isTagsEnabled()) return 0;
  ensureTags();
  const tags = runtime.tags;
  if (!tags) return 0;
  const w = runtime.width;
  const h = runtime.height;
  let n = 0;
  for (const { x, y } of cells) {
    const i = y * w + x;
    if (setTag(i, TAG.MATERIALISED, tags)) n++;
    n += markBorderExplored(x, y, border, tags, w, h);
  }
  return n;
}

/** Coalesce region patches to one rAF (hold-fire was patching every tick). */
let patchDirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
let patchRaf = 0;

export function patchGhostRegion(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  if (!patchDirty) {
    patchDirty = { x0, y0, x1, y1 };
  } else {
    patchDirty.x0 = Math.min(patchDirty.x0, x0);
    patchDirty.y0 = Math.min(patchDirty.y0, y0);
    patchDirty.x1 = Math.max(patchDirty.x1, x1);
    patchDirty.y1 = Math.max(patchDirty.y1, y1);
  }
  if (patchRaf) return;
  patchRaf = requestAnimationFrame(() => {
    patchRaf = 0;
    const d = patchDirty;
    patchDirty = null;
    if (d) flushGhostPatch(d.x0, d.y0, d.x1, d.y1);
  }) as unknown as number;
}

function flushGhostPatch(
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
  const tags = isTagsEnabled() ? runtime.tags : null;
  const img = ctx.createImageData(pw, ph);
  const tagsOn = isTagsEnabled();

  for (let y = top; y <= bottom; y++) {
    const row = y * w;
    const py = y - top;
    for (let x = left; x <= right; x++) {
      const i = row + x;
      const o = (py * pw + (x - left)) * 4;
      const code = data[i]!;
      const tag = tags ? tags[i]! : TAG.MATERIALISED;
      const base = (FALLBACK_CODE_COLORS[code] ?? [0, 0, 0, 0]) as RgbaOut;
      const [rr, gg, bb, aa] = compositeTagPixel(code, tag, base, tagsOn);
      img.data[o] = rr;
      img.data[o + 1] = gg;
      img.data[o + 2] = bb;
      img.data[o + 3] = aa;
    }
  }
  ctx.putImageData(img, left, top);
}
