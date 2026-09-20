/**
 * Hidden World — persistence.
 *
 * The terrain itself lives only in this session's memory; what is saved on the
 * session is the **seed** (save-backed `api.storage`). Regenerating the matrix
 * from the seed is deterministic, so the hidden world survives reloads without
 * storing a whole map.
 */

import { DEFAULT_PARAMS, FALLBACK_CELLS, LOG, MOD, STORAGE_KEY_SEED } from "./constants.ts";
import { api } from "./api.ts";
import { runtime } from "./state.ts";
import type { BandParams, GenerationParams, SkyParams, SkyWave } from "./types.ts";
import type { Size } from "@sandmd/shared";

interface SeedRecord {
    seed: string;
    width: number;
    height: number;
    params?: GenerationParams;
}

/** A short random seed — hex from two random 32-bit halves. */
export function randomSeed(): string {
    const hi = Math.floor(Math.random() * 0xffffffff).toString(16);
    const lo = Math.floor(Math.random() * 0xffffffff).toString(16);
    return `${hi}${lo}`;
}

/** Real map size in cells, falling back to a sane default. */
export function readWorldSize(): Size {
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

/** First number found, else the fallback (rounded — the UI is integer-based). */
function numOr(value: unknown, fallback: number): number {
    return typeof value === "number" && isFinite(value) ? Math.round(value) : fallback;
}

/** Clamp an integer percent into [min, max]. */
function clampPercent(value: unknown, fallback: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, numOr(value, fallback)));
}

/** Validate one saved band over the defaults (missing fields fall back). */
function normalizeBand(saved: unknown, fallback: BandParams): BandParams {
    const raw = (saved ?? {}) as Partial<BandParams>;
    return {
        thicknessPercent: clampPercent(raw.thicknessPercent, fallback.thicknessPercent, 0, 50),
        definitionPercent: clampPercent(
            raw.definitionPercent,
            fallback.definitionPercent,
            0,
            95,
        ),
        offsetX: numOr(raw.offsetX, fallback.offsetX),
        offsetY: numOr(raw.offsetY, fallback.offsetY),
    };
}

/** Validate one saved skyline wave (period ≥ 2 cells, amp 0–100%). */
function normalizeWave(saved: unknown, fallback: SkyWave): SkyWave {
    const raw = (saved ?? {}) as Partial<SkyWave>;
    return {
        periodCells: clampPercent(raw.periodCells, fallback.periodCells, 2, 100000),
        amplitudePercent: clampPercent(raw.amplitudePercent, fallback.amplitudePercent, 0, 100),
    };
}

/** Validate the four skyline waves over the defaults. */
function normalizeSky(saved: unknown): SkyParams {
    const raw = (saved ?? {}) as Partial<SkyParams>;
    return {
        bigWave: normalizeWave(raw.bigWave, DEFAULT_PARAMS.sky.bigWave),
        mediumWave: normalizeWave(raw.mediumWave, DEFAULT_PARAMS.sky.mediumWave),
        lowWave: normalizeWave(raw.lowWave, DEFAULT_PARAMS.sky.lowWave),
        roughness: normalizeWave(raw.roughness, DEFAULT_PARAMS.sky.roughness),
    };
}

/** Merge a saved params object over the defaults (clamped to valid ranges). */
export function normalizeParams(saved: unknown): GenerationParams {
    const raw = (saved ?? {}) as Partial<GenerationParams>;
    return {
        sky: normalizeSky(raw.sky),
        baseHeightPercent: clampPercent(
            raw.baseHeightPercent,
            DEFAULT_PARAMS.baseHeightPercent,
            5,
            90,
        ),
        tunnel: normalizeBand(raw.tunnel, DEFAULT_PARAMS.tunnel),
        cave: normalizeBand(raw.cave, DEFAULT_PARAMS.cave),
    };
}

/** Write the current seed + size + params to save-backed storage. */
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

/**
 * Load the seed record, or create + persist a new one. `created` tells the
 * caller whether this is a brand-new hidden world.
 */
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
