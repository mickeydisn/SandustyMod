import { DEFAULT_PARAMS, FALLBACK_CELLS, LOG, MOD, STORAGE_KEY_EXPLORED, STORAGE_KEY_MAP, STORAGE_KEY_SEED } from "./constants.ts";
import { api } from "../api/api.ts";
import { runtime } from "./state.ts";
import type {
  BandParams,
  FormModifier,
  GenerationParams,
  LiquidModifier,
  MapBoundsPercent,
  Modifier,
  SealParams,
  SkyParams,
  WallModifier,
} from "./types.ts";

function clamp(v: unknown, fb: number, min: number, max: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : fb;
  return Math.min(max, Math.max(min, n));
}
function boolOr(v: unknown, fb: boolean): boolean {
  return typeof v === "boolean" ? v : fb;
}
function numOr(v: unknown, fb: number): number {
  return typeof v === "number" && isFinite(v) ? v : fb;
}
function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeBounds(raw: unknown, fb: MapBoundsPercent): MapBoundsPercent {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    top: clamp(b.top, fb.top, 0, 100),
    bottom: clamp(b.bottom, fb.bottom, 0, 100),
    left: clamp(b.left, fb.left, 0, 100),
    right: clamp(b.right, fb.right, 0, 100),
  };
}

function normalizeBand(saved: unknown, fb: BandParams): BandParams {
  const raw = (saved ?? {}) as Partial<BandParams>;
  return {
    enabled: boolOr(raw.enabled, fb.enabled),
    thicknessPercent: clamp(raw.thicknessPercent, fb.thicknessPercent, 0, 50),
    definitionPercent: clamp(raw.definitionPercent, fb.definitionPercent, 0, 95),
    offsetX: numOr(raw.offsetX, fb.offsetX),
    offsetY: numOr(raw.offsetY, fb.offsetY),
  };
}

function normalizeSky(saved: unknown): SkyParams {
  const raw = (saved ?? {}) as Partial<SkyParams>;
  const fb = DEFAULT_PARAMS.sky;
  const wave = (w: unknown, d: typeof fb.bigWave) => {
    const r = (w ?? {}) as Record<string, unknown>;
    return {
      periodCells: clamp(r.periodCells, d.periodCells, 2, 1_000_000),
      amplitudePercent: clamp(r.amplitudePercent, d.amplitudePercent, 0, 100),
    };
  };
  return {
    bigWave: wave(raw.bigWave, fb.bigWave),
    mediumWave: wave(raw.mediumWave, fb.mediumWave),
    lowWave: wave(raw.lowWave, fb.lowWave),
    roughness: wave(raw.roughness, fb.roughness),
  };
}

function normalizeSeal(saved: unknown): SealParams {
  const raw = (saved ?? {}) as Partial<SealParams>;
  const fb = DEFAULT_PARAMS.seal;
  return {
    enabled: boolOr(raw.enabled, fb.enabled),
    maxIterations: clamp(raw.maxIterations, fb.maxIterations, 50, 800),
    sealTunnels: boolOr(raw.sealTunnels, fb.sealTunnels),
    sealCaves: boolOr(raw.sealCaves, fb.sealCaves),
    diagonal: boolOr(raw.diagonal, fb.diagonal),
    surfaceKeepPercent: clamp(raw.surfaceKeepPercent, fb.surfaceKeepPercent, 0, 40),
  };
}

function normalizeModifier(raw: unknown, index: number): Modifier | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kind = r.kind as string;
  const id = typeof r.id === "string" ? r.id : uid(kind || "mod");
  const enabled = boolOr(r.enabled, true);
  const name = typeof r.name === "string" ? r.name : `Modifier ${index + 1}`;
  const fbBounds = { top: 0, bottom: 100, left: 0, right: 100 };

  if (kind === "wall") {
    const m: WallModifier = {
      id,
      kind: "wall",
      enabled,
      name,
      inBorderOf: Array.isArray(r.inBorderOf) ? r.inBorderOf as number[] : [1],
      typeToReplace: Array.isArray(r.typeToReplace) ? r.typeToReplace as number[] : [2],
      replaceBy: numOr(r.replaceBy, 7),
      nearMask: (Array.isArray(r.nearMask) && (r.nearMask as number[]).length === 4
        ? r.nearMask as [number, number, number, number]
        : [1, 0, 0, 0]),
      bounds: normalizeBounds(r.bounds, fbBounds),
      growSize: clamp(r.growSize, 3, 0, 32),
    };
    return m;
  }
  if (kind === "form") {
    const m: FormModifier = {
      id,
      kind: "form",
      enabled,
      name,
      inBorderOf: Array.isArray(r.inBorderOf) ? r.inBorderOf as number[] : [3],
      replaceBy: numOr(r.replaceBy, 10),
      bounds: normalizeBounds(r.bounds, fbBounds),
      growSize: clamp(r.growSize, 5, 0, 32),
      scatterPercent: clamp(r.scatterPercent, 35, 0, 100),
    };
    return m;
  }
  if (kind === "liquid") {
    const lt = r.liquidType === "lava" || r.liquidType === "surface" ? r.liquidType : "water";
    const m: LiquidModifier = {
      id,
      kind: "liquid",
      enabled,
      name,
      liquidType: lt,
      minDepth: clamp(r.minDepth, 4, 1, 50),
      bounds: normalizeBounds(r.bounds, fbBounds),
    };
    return m;
  }
  return null;
}

/** Migrate legacy fluids/wallGrow/formGrow into modifiers if needed. */
function migrateLegacyModifiers(raw: Record<string, unknown>): Modifier[] {
  const list: Modifier[] = [];
  const fluids = raw.fluids as Record<string, unknown> | undefined;
  if (fluids) {
    if (fluids.water !== false) {
      list.push({
        id: "legacy-water",
        kind: "liquid",
        enabled: boolOr(fluids.enabled, true),
        name: "Underground Water",
        liquidType: "water",
        minDepth: numOr(fluids.waterMinDepth, 4),
        bounds: { top: 20, bottom: 90, left: 0, right: 100 },
      });
    }
    if (fluids.lava) {
      list.push({
        id: "legacy-lava",
        kind: "liquid",
        enabled: boolOr(fluids.enabled, true),
        name: "Deep Lava",
        liquidType: "lava",
        minDepth: numOr(fluids.lavaMinDepth, 6),
        bounds: { top: 50, bottom: 100, left: 0, right: 100 },
      });
    }
    if (fluids.surfaceWater) {
      list.push({
        id: "legacy-surface",
        kind: "liquid",
        enabled: boolOr(fluids.enabled, true),
        name: "Surface Water",
        liquidType: "surface",
        minDepth: numOr(fluids.surfaceWaterDepth, 3),
        bounds: { top: 0, bottom: 20, left: 0, right: 100 },
      });
    }
  }
  const wall = raw.wallGrow as { rules?: unknown[] } | undefined;
  if (wall?.rules) {
    for (const r of wall.rules) {
      const m = normalizeModifier({ ...(r as object), kind: "wall" }, list.length);
      if (m) list.push(m);
    }
  }
  const form = raw.formGrow as { rules?: unknown[] } | undefined;
  if (form?.rules) {
    for (const r of form.rules) {
      const m = normalizeModifier({ ...(r as object), kind: "form" }, list.length);
      if (m) list.push(m);
    }
  }
  return list;
}

export function normalizeParams(saved: unknown): GenerationParams {
  const raw = (saved ?? {}) as Record<string, unknown>;
  let modifiers: Modifier[] = [];
  if (Array.isArray(raw.modifiers) && raw.modifiers.length > 0) {
    for (let i = 0; i < raw.modifiers.length; i++) {
      const m = normalizeModifier(raw.modifiers[i], i);
      if (m) modifiers.push(m);
    }
  } else {
    modifiers = migrateLegacyModifiers(raw);
    if (modifiers.length === 0) {
      modifiers = JSON.parse(JSON.stringify(DEFAULT_PARAMS.modifiers));
    }
  }
  return {
    sky: normalizeSky(raw.sky),
    baseHeightPercent: clamp(raw.baseHeightPercent, DEFAULT_PARAMS.baseHeightPercent, 5, 90),
    tunnel: normalizeBand(raw.tunnel, DEFAULT_PARAMS.tunnel),
    cave: normalizeBand(raw.cave, DEFAULT_PARAMS.cave),
    seal: normalizeSeal(raw.seal),
    modifiers,
    explorationEnabled: boolOr(raw.explorationEnabled, DEFAULT_PARAMS.explorationEnabled),
  };
}

export function readWorldSize(): { width: number; height: number } {
  try {
    const d = api.grid.getDimensions?.();
    if (d) {
      const w = d.widthCells ?? d.width ?? 0;
      const h = d.heightCells ?? d.height ?? 0;
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  } catch { /* */ }
  return { ...FALLBACK_CELLS };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}


function u8ToB64(u8: Uint8Array): string {
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < u8.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, u8.length);
    // avoid spread stack overflow on large chunks
    let part = "";
    for (let j = i; j < end; j++) part += String.fromCharCode(u8[j]!);
    s += part;
  }
  return btoa(s);
}

function b64ToU8(b64: string): Uint8Array | null {
  try {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  } catch {
    return null;
  }
}

/** Persist hidden matrix + exploration mask (debounced callers OK). */
/** Light save: exploration mask only (called while exploring — avoids lag spikes). */
export function persistExploredOnly(): void {
  try {
    if (!runtime.explored || runtime.explored.length !== runtime.width * runtime.height) return;
    api.storage.ensure(MOD);
    api.storage.set(MOD, STORAGE_KEY_EXPLORED, {
      w: runtime.width,
      h: runtime.height,
      data: u8ToB64(runtime.explored),
    });
  } catch (err) {
    console.warn(`${LOG} persistExploredOnly failed`, err);
  }
}

export function persistWorldData(): void {
  try {
    api.storage.ensure(MOD);
    api.storage.set(MOD, STORAGE_KEY_SEED, {
      seed: runtime.seed,
      width: runtime.width,
      height: runtime.height,
      params: runtime.params,
    });
    if (runtime.data && runtime.data.length === runtime.width * runtime.height) {
      api.storage.set(MOD, STORAGE_KEY_MAP, {
        w: runtime.width,
        h: runtime.height,
        seed: runtime.seed,
        data: u8ToB64(runtime.data),
      });
    }
    if (runtime.explored && runtime.explored.length === runtime.width * runtime.height) {
      api.storage.set(MOD, STORAGE_KEY_EXPLORED, {
        w: runtime.width,
        h: runtime.height,
        data: u8ToB64(runtime.explored),
      });
    } else if (!runtime.params.explorationEnabled) {
      try { api.storage.set(MOD, STORAGE_KEY_EXPLORED, null); } catch { /* */ }
    }
  } catch (err) {
    console.warn(`${LOG} persistWorldData failed`, err);
  }
}

export function loadWorldData(): boolean {
  try {
    api.storage.ensure(MOD);
    const map = api.storage.get(MOD, STORAGE_KEY_MAP) as Record<string, unknown> | null;
    if (!map || typeof map.data !== "string") return false;
    const w = Number(map.w) || 0;
    const h = Number(map.h) || 0;
    if (w <= 0 || h <= 0) return false;
    // Prefer live world size if available
    const live = readWorldSize();
    if (live.width > 0 && live.height > 0 && (live.width !== w || live.height !== h)) {
      // size mismatch — discard saved map
      return false;
    }
    const data = b64ToU8(map.data);
    if (!data || data.length !== w * h) return false;
    runtime.width = w;
    runtime.height = h;
    if (typeof map.seed === "string") runtime.seed = map.seed;
    runtime.data = data;
    runtime.cache = null;

    const exp = api.storage.get(MOD, STORAGE_KEY_EXPLORED) as Record<string, unknown> | null;
    if (exp && typeof exp.data === "string" && Number(exp.w) === w && Number(exp.h) === h) {
      const mask = b64ToU8(exp.data);
      if (mask && mask.length === w * h) {
        runtime.explored = mask;
      } else {
        runtime.explored = null;
      }
    } else {
      runtime.explored = null;
    }
    console.log(`${LOG} loaded persisted map ${w}×${h}`);
    return true;
  } catch (err) {
    console.warn(`${LOG} loadWorldData failed`, err);
    return false;
  }
}

/** Clear stored map (after explicit regenerate). */
export function clearPersistedWorldData(): void {
  try {
    api.storage.ensure(MOD);
    api.storage.set(MOD, STORAGE_KEY_MAP, null);
    api.storage.set(MOD, STORAGE_KEY_EXPLORED, null);
  } catch { /* */ }
}

export function persistRecord(): void {
  persistWorldData();
}

export function ensureSeedRecord(): { created: boolean } {
  try {
    api.storage.ensure(MOD);
  } catch { /* */ }
  const size = readWorldSize();
  try {
    const saved = api.storage.get(MOD, STORAGE_KEY_SEED) as Record<string, unknown> | null;
    if (saved && typeof saved.seed === "string") {
      runtime.seed = saved.seed;
      runtime.width = typeof saved.width === "number" && saved.width > 0 ? saved.width : size.width;
      runtime.height = typeof saved.height === "number" && saved.height > 0 ? saved.height : size.height;
      runtime.params = normalizeParams(saved.params);
      loadWorldData();
      return { created: false };
    }
  } catch { /* */ }
  runtime.seed = randomSeed();
  runtime.width = size.width;
  runtime.height = size.height;
  runtime.params = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  persistRecord();
  return { created: true };
}
