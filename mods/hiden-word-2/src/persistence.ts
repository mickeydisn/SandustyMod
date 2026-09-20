import { DEFAULT_PARAMS, FALLBACK_CELLS, LOG, MOD, STORAGE_KEY_SEED } from "./constants.ts";
import { api } from "./api.ts";
import { runtime } from "./state.ts";
import type {
  BandParams,
  FluidsParams,
  FormGrowParams,
  GenerationParams,
  SealParams,
  SkyParams,
  SkyWave,
  WallGrowParams,
} from "./types.ts";

interface SeedRecord {
  seed: string;
  width: number;
  height: number;
  params?: GenerationParams;
}

export function randomSeed(): string {
  const hi = Math.floor(Math.random() * 0xffffffff).toString(16);
  const lo = Math.floor(Math.random() * 0xffffffff).toString(16);
  return `${hi}${lo}`;
}

export function readWorldSize(): { width: number; height: number } {
  try {
    const dims = api.grid?.getDimensions?.();
    if (dims && dims.widthCells > 0 && dims.heightCells > 0) {
      return { width: dims.widthCells, height: dims.heightCells };
    }
  } catch (err) {
    console.warn(`${LOG} getDimensions failed`, err);
  }
  return { ...FALLBACK_CELLS };
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" && isFinite(value) ? Math.round(value) : fallback;
}
function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, numOr(value, fallback)));
}
function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeWave(saved: unknown, fallback: SkyWave): SkyWave {
  const raw = (saved ?? {}) as Partial<SkyWave>;
  return {
    periodCells: clamp(raw.periodCells, fallback.periodCells, 2, 100000),
    amplitudePercent: clamp(raw.amplitudePercent, fallback.amplitudePercent, 0, 100),
  };
}
function normalizeSky(saved: unknown): SkyParams {
  const raw = (saved ?? {}) as Partial<SkyParams>;
  return {
    bigWave: normalizeWave(raw.bigWave, DEFAULT_PARAMS.sky.bigWave),
    mediumWave: normalizeWave(raw.mediumWave, DEFAULT_PARAMS.sky.mediumWave),
    lowWave: normalizeWave(raw.lowWave, DEFAULT_PARAMS.sky.lowWave),
    roughness: normalizeWave(raw.roughness, DEFAULT_PARAMS.sky.roughness),
  };
}
function normalizeBand(saved: unknown, fallback: BandParams): BandParams {
  const raw = (saved ?? {}) as Partial<BandParams>;
  return {
    enabled: boolOr(raw.enabled, fallback.enabled),
    thicknessPercent: clamp(raw.thicknessPercent, fallback.thicknessPercent, 0, 50),
    definitionPercent: clamp(raw.definitionPercent, fallback.definitionPercent, 0, 95),
    offsetX: numOr(raw.offsetX, fallback.offsetX),
    offsetY: numOr(raw.offsetY, fallback.offsetY),
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
function normalizeFluids(saved: unknown): FluidsParams {
  const raw = (saved ?? {}) as Partial<FluidsParams>;
  const fb = DEFAULT_PARAMS.fluids;
  return {
    enabled: boolOr(raw.enabled, fb.enabled),
    water: boolOr(raw.water, fb.water),
    lava: boolOr(raw.lava, fb.lava),
    surfaceWater: boolOr(raw.surfaceWater, fb.surfaceWater),
    waterMinDepth: clamp(raw.waterMinDepth, fb.waterMinDepth, 1, 40),
    lavaMinDepth: clamp(raw.lavaMinDepth, fb.lavaMinDepth, 1, 40),
    surfaceWaterDepth: clamp(raw.surfaceWaterDepth, fb.surfaceWaterDepth, 1, 20),
  };
}
function normalizeWall(saved: unknown): WallGrowParams {
  const raw = (saved ?? {}) as Partial<WallGrowParams>;
  const fb = DEFAULT_PARAMS.wallGrow;
  // If old format without rules, fall back to defaults
  const rules = Array.isArray(raw.rules) && raw.rules.length > 0
    ? raw.rules.map((r, i) => {
      const d = fb.rules[i] ?? fb.rules[0]!;
      const rr = (r ?? {}) as Record<string, unknown>;
      return {
        enabled: boolOr(rr.enabled, d.enabled),
        name: typeof rr.name === "string" ? rr.name : d.name,
        inBorderOf: Array.isArray(rr.inBorderOf) ? rr.inBorderOf as number[] : d.inBorderOf,
        typeToReplace: Array.isArray(rr.typeToReplace) ? rr.typeToReplace as number[] : d.typeToReplace,
        replaceBy: numOr(rr.replaceBy, d.replaceBy),
        nearMask: (Array.isArray(rr.nearMask) && (rr.nearMask as number[]).length === 4
          ? rr.nearMask as [number, number, number, number]
          : d.nearMask),
        minDistPercent: clamp(rr.minDistPercent, d.minDistPercent, 0, 100),
        thicknessPercent: clamp(rr.thicknessPercent, d.thicknessPercent, 0, 100),
        growSize: clamp(rr.growSize, d.growSize, 0, 32),
      };
    })
    : JSON.parse(JSON.stringify(fb.rules));
  return {
    enabled: boolOr(raw.enabled, fb.enabled),
    rules,
  };
}
function normalizeForm(saved: unknown): FormGrowParams {
  const raw = (saved ?? {}) as Partial<FormGrowParams>;
  const fb = DEFAULT_PARAMS.formGrow;
  const rules = Array.isArray(raw.rules) && raw.rules.length > 0
    ? raw.rules.map((r, i) => {
      const d = fb.rules[i] ?? fb.rules[0]!;
      const rr = (r ?? {}) as Record<string, unknown>;
      return {
        enabled: boolOr(rr.enabled, d.enabled),
        name: typeof rr.name === "string" ? rr.name : d.name,
        inBorderOf: Array.isArray(rr.inBorderOf) ? rr.inBorderOf as number[] : d.inBorderOf,
        replaceBy: numOr(rr.replaceBy, d.replaceBy),
        minDistPercent: clamp(rr.minDistPercent, d.minDistPercent, 0, 100),
        thicknessPercent: clamp(rr.thicknessPercent, d.thicknessPercent, 0, 100),
        growSize: clamp(rr.growSize, d.growSize, 0, 32),
      };
    })
    : JSON.parse(JSON.stringify(fb.rules));
  return {
    enabled: boolOr(raw.enabled, fb.enabled),
    rules,
  };
}

export function normalizeParams(saved: unknown): GenerationParams {
  const raw = (saved ?? {}) as Partial<GenerationParams>;
  return {
    sky: normalizeSky(raw.sky),
    baseHeightPercent: clamp(raw.baseHeightPercent, DEFAULT_PARAMS.baseHeightPercent, 5, 90),
    tunnel: normalizeBand(raw.tunnel, DEFAULT_PARAMS.tunnel),
    cave: normalizeBand(raw.cave, DEFAULT_PARAMS.cave),
    seal: normalizeSeal(raw.seal),
    fluids: normalizeFluids(raw.fluids),
    wallGrow: normalizeWall(raw.wallGrow),
    formGrow: normalizeForm(raw.formGrow),
  };
}

export function persistRecord(): void {
  try {
    api.storage?.set(MOD, STORAGE_KEY_SEED, {
      seed: runtime.seed,
      width: runtime.width,
      height: runtime.height,
      params: runtime.params,
    });
  } catch (err) {
    console.warn(`${LOG} storage.set failed`, err);
  }
}

export function ensureSeedRecord(): { created: boolean } {
  try {
    api.storage?.ensure(MOD);
  } catch (err) {
    console.warn(`${LOG} storage.ensure failed`, err);
  }
  const size = readWorldSize();
  try {
    const saved = api.storage?.get(MOD, STORAGE_KEY_SEED) as SeedRecord | null;
    if (saved && typeof saved.seed === "string" && saved.seed.length > 0) {
      runtime.seed = saved.seed;
      runtime.width = saved.width > 0 ? saved.width : size.width;
      runtime.height = saved.height > 0 ? saved.height : size.height;
      runtime.params = normalizeParams(saved.params);
      return { created: false };
    }
  } catch (err) {
    console.warn(`${LOG} storage.get failed`, err);
  }
  runtime.seed = randomSeed();
  runtime.width = size.width;
  runtime.height = size.height;
  runtime.params = normalizeParams(undefined);
  persistRecord();
  return { created: true };
}
