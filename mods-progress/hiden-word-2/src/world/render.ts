/**
 * Ghost view: 1px/cell cache + frame blit while lens selected.
 */

import {
  CODE_LABELS,
  CODE_TERRAIN,
  FALLBACK_CODE_COLORS,
  LOG,
  TERRAIN,
  TERRAIN_META_NAMES,
  TERRAIN_NAME_KEY_PREFIX,
} from "./constants.ts";
import { api } from "../api/api.ts";
import { isInfiniteLensSelected, isLensSelected } from "../tools/lens.ts";
import { isMaterializerSelected, paintManifestBrush } from "../tools/materializer.ts";
import { isExplorerSelected, paintExplorerBrush } from "../tools/explorer.ts";
import {
  notifyGenerationEnd,
  notifyGenerationProgress,
  notifyGenerationStart,
} from "../gen/progress.ts";
import { runtime } from "./state.ts";
import { generateHiddenTerrain } from "../gen/terrain.ts";
import { compositeTagPixel, isTagsEnabled, resetTagsFromMap, TAG } from "./tags.ts";
import { clearPersistedWorldData, persistWorldData } from "./persistence.ts";
import { readWorldSize } from "./persistence.ts";
import type { Rgba, TerrainDefinitionLike } from "./types.ts";

function packedToRgba(packed: number): Rgba {
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255];
}
function hexToRgba(value: string): Rgba | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
}
function normalizeRgb(rgb: number[]): Rgba {
  const [r, g, b] = rgb;
  const scale = Math.max(r, g, b) <= 1 ? 255 : 1;
  return [Math.round(r * scale), Math.round(g * scale), Math.round(b * scale), 255];
}
function hslToRgba(hsl: number[]): Rgba | null {
  if (hsl.length < 3) return null;
  const h = (((hsl[0]! % 360) + 360) % 360);
  const s = Math.min(100, Math.max(0, hsl[1]!)) / 100;
  const l = Math.min(100, Math.max(0, hsl[2]!)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255), 255];
}

type ColorSource = "engine metaColor" | "engine colorHSL" | "engine color" | "catalog fallback";

function rgbFromTerrainDef(def: TerrainDefinitionLike | null | undefined): { rgba: Rgba; source: ColorSource } | null {
  if (!def || typeof def !== "object") return null;
  const meta = def.metaColor;
  if (typeof meta === "number" && Number.isFinite(meta)) return { rgba: packedToRgba(meta), source: "engine metaColor" };
  if (typeof meta === "string") {
    const fromHex = hexToRgba(meta);
    if (fromHex) return { rgba: fromHex, source: "engine metaColor" };
  }
  const hsl = def.colorHSL;
  if (Array.isArray(hsl)) {
    const fromHsl = hslToRgba(hsl as number[]);
    if (fromHsl) return { rgba: fromHsl, source: "engine colorHSL" };
  }
  const color = def.color;
  if (typeof color === "number" && Number.isFinite(color)) return { rgba: packedToRgba(color), source: "engine color" };
  if (Array.isArray(color)) return { rgba: normalizeRgb(color as number[]), source: "engine color" };
  return null;
}

const ALL_CODES = Object.values(TERRAIN).filter((v) => typeof v === "number") as number[];

function resolveTerrainColor(id: string): { rgba: Rgba; source: ColorSource } | null {
  try {
    const type = api.terrains.getTypeById?.(id);
    if (typeof type !== "number") return null;
    return rgbFromTerrainDef(api.terrains.getDefinitionByType?.(type));
  } catch {
    return null;
  }
}

function resolveTerrainName(id: string): string | null {
  const key = `${TERRAIN_NAME_KEY_PREFIX}|${id}|name`;
  try {
    const translated = api.i18n.t?.(key);
    if (typeof translated === "string" && translated.length > 0 && translated !== key) return translated;
  } catch { /* */ }
  return TERRAIN_META_NAMES[id] ?? null;
}

function toHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export interface PaletteEntry {
  code: number;
  terrain: string | null;
  codeLabel: string;
  label: string;
  rgba: Rgba;
  hex: string;
  alpha: number;
  source: ColorSource | "transparent" | "fallback paint";
}

function resolvePaletteEntry(code: number): PaletteEntry {
  const terrain = CODE_TERRAIN[code] ?? null;
  const codeLabel = CODE_LABELS[code] ?? String(code);
  const fallback = FALLBACK_CODE_COLORS[code] ?? [0, 0, 0, 0];

  if (terrain) {
    const resolved = resolveTerrainColor(terrain);
    const rgba = resolved?.rgba ?? fallback;
    return {
      code,
      terrain,
      codeLabel,
      label: `${resolveTerrainName(terrain) ?? terrain} (${terrain})`,
      rgba,
      hex: toHex(rgba),
      alpha: rgba[3],
      source: resolved?.source ?? "catalog fallback",
    };
  }
  // fluids / specials painted from FALLBACK
  if (fallback[3] > 0) {
    return {
      code,
      terrain: null,
      codeLabel,
      label: codeLabel,
      rgba: fallback,
      hex: toHex(fallback),
      alpha: fallback[3],
      source: "fallback paint",
    };
  }
  return {
    code,
    terrain: null,
    codeLabel,
    label: `${codeLabel} — transparent`,
    rgba: [0, 0, 0, 0],
    hex: "#000000",
    alpha: 0,
    source: "transparent",
  };
}

let paletteCache: PaletteEntry[] | null = null;

export function ghostPalette(): PaletteEntry[] {
  if (!paletteCache) paletteCache = ALL_CODES.map(resolvePaletteEntry);
  return paletteCache;
}

export function buildCache(): HTMLCanvasElement | null {
  if (!runtime.data) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = runtime.width;
    canvas.height = runtime.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const entries = ghostPalette();
    const table = new Map<number, Rgba>();
    for (const entry of entries) table.set(entry.code, entry.rgba);
    const image = ctx.createImageData(runtime.width, runtime.height);
    // Terrain + tag overlays (Hidden black / Explored red50 / Materialised blue50 / fog 15%)
    const tagsOn = isTagsEnabled() && runtime.cacheTags !== false && runtime.showTagsOverlay !== false;
    const mask = tagsOn ? runtime.tags : null;
    for (let i = 0; i < runtime.data.length; i++) {
      const o = i * 4;
      const code = runtime.data[i]!;
      const base = (table.get(code) ?? [0, 0, 0, 0]) as [number, number, number, number];
      const tag = mask ? mask[i]! : TAG.MATERIALISED;
      const [rr, gg, bb, aa] = compositeTagPixel(code, tag, base, tagsOn);
      image.data[o] = rr;
      image.data[o + 1] = gg;
      image.data[o + 2] = bb;
      image.data[o + 3] = aa;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } catch (err) {
    console.warn(`${LOG} cache build failed`, err);
    return null;
  }
}

/**
 * Build matrix + cache. Shows start/progress/end alerts so the player knows
 * generation is running (large maps can take a noticeable time).
 */
let generating: Promise<void> | null = null;

export function isWorldGenerating(): boolean {
  return generating != null;
}

/** Ensure matrix + ghost cache exist. Generation is async (does not freeze UI). */
export function ensureCache(showAlerts: boolean): void {
  if (runtime.cache || runtime.buildFailed) return;
  if (runtime.data) {
    runtime.cache = buildCache();
    return;
  }
  if (generating) return;
  generating = runGeneration(showAlerts).finally(() => {
    generating = null;
  });
}

async function runGeneration(showAlerts: boolean): Promise<void> {
  const t0 = performance.now?.() ?? Date.now();
  try {
    const live = readWorldSize();
    if (live.width > 0 && live.height > 0) {
      runtime.width = live.width;
      runtime.height = live.height;
    }
    if (showAlerts) {
      notifyGenerationStart(runtime.width, runtime.height);
    }
    const result = await generateHiddenTerrain(
      runtime.seed,
      runtime.width,
      runtime.height,
      runtime.params,
      showAlerts ? notifyGenerationProgress : undefined,
    );
    runtime.data = result.data;
    runtime.skyDistance = result.skyDistance;
    resetTagsFromMap();
    runtime.cache = buildCache();
    persistWorldData();
    if (showAlerts) {
      notifyGenerationEnd(!!runtime.cache, (performance.now?.() ?? Date.now()) - t0);
    }
  } catch (err) {
    console.warn(`${LOG} terrain build failed`, err);
    runtime.buildFailed = true;
    if (showAlerts) {
      notifyGenerationEnd(false, (performance.now?.() ?? Date.now()) - t0);
    }
  }
}

/** Force full rebuild (Map Viewer Generate). Returns when done. */
export async function refreshHiddenWorld(): Promise<boolean> {
  if (generating) await generating;
  runtime.data = null;
  runtime.skyDistance = null;
  runtime.cache = null;
  runtime.tags = null;
  runtime.buildFailed = false;
  paletteCache = null;
  clearPersistedWorldData();
  generating = runGeneration(true).finally(() => {
    generating = null;
  });
  await generating;
  return !runtime.buildFailed;
}

/** Rebuild ghost pixels without regenerating the matrix (after explore). */
export function rebuildGhostCache(): void {
  if (!runtime.data) return;
  runtime.cache = buildCache();
}


/** Drop pixel cache so next paint rebuilds (e.g. after explore). */
export function invalidateGhostCache(): void {
  runtime.cache = null;
}

export function paintGhostView(): void {
  const showGhost = isLensSelected() || isMaterializerSelected() || isExplorerSelected();
  if (!showGhost) return;
  ensureCache(!runtime.data);
  if (!runtime.cache) return;

  // Infinite lens / overlay toggle: show raw hidden map without tag colors
  const hideTags = isInfiniteLensSelected() || runtime.showTagsOverlay === false;
  if (hideTags && runtime.cacheTags !== false) {
    runtime.cache = null;
    runtime.cacheTags = false;
    ensureCache(false);
  } else if (!hideTags && runtime.cacheTags === false) {
    runtime.cache = null;
    runtime.cacheTags = true;
    ensureCache(false);
  }
  if (!runtime.cache) return;

  try {
    api.rendering.withOverlayContext((ctx) => {
      if (!ctx || !runtime.cache) return;
      const cellSize = api.rendering.getGridMetrics().cellSize;
      const viewport = api.rendering.getOverlayViewportSize?.() ?? {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
      };
      const origin = api.rendering.getDrawPositionAtWorld(0, 0);
      const step = api.rendering.getDrawPositionAtWorld(cellSize, cellSize);
      const scale = { x: step.x - origin.x, y: step.y - origin.y };
      if (scale.x <= 0 || scale.y <= 0) return;
      const sx = Math.max(0, Math.floor(-origin.x / scale.x));
      const sy = Math.max(0, Math.floor(-origin.y / scale.y));
      const sw = Math.min(runtime.width - sx, Math.ceil(viewport.width / scale.x) + 1);
      const sh = Math.min(runtime.height - sy, Math.ceil(viewport.height / scale.y) + 1);
      if (sw <= 0 || sh <= 0) return;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = runtime.alpha;
      ctx.drawImage(
        runtime.cache,
        sx, sy, sw, sh,
        origin.x + sx * scale.x,
        origin.y + sy * scale.y,
        sw * scale.x,
        sh * scale.y,
      );
      ctx.restore();
    });
  } catch (err) {
    console.warn(`${LOG} paint failed`, err);
  }

  try { paintManifestBrush(); } catch { /* */ }
  try { paintExplorerBrush(); } catch { /* */ }
}
