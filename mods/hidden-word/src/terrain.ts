/**
 * Hidden World — the hidden terrain generator.
 *
 * Port of the sandgenerator-web "first step": seeded simplex noise
 * (skyline 1D + tunnel/cave 2D bands) merged into one terrain matrix, exactly
 * like `noiseGeneration1D.js` / `noiseGeneration2D.js` / `mapGeneration.js`.
 * Tunables come from `GenerationParams` (percents); wave sets and bottom-edge
 * rules stay fixed like the web config. Pure functions only.
 *
 * The optional Fluid Generation pass (mapGeneration.js step 4) is a CPU port of
 * the GPU flood-fill kernels: fog water, lava, and surface water fill the
 * tunnels/caves from the bottom / edges, with distance-threshold pruning so
 * small pools drain away. The hidden parameters (iteration counts + pool-size
 * thresholds) are the hardcoded values from `mapGeneration.js`.
 */

import {
    CAVE_WAVES,
    NOISE_ZOOM_1D,
    NOISE_ZOOM_2D,
    SKYLINE_FIXED,
    TERRAIN,
    TUNNEL_WAVES,
} from "./constants.ts";
import { SimplexNoise } from "./noise.ts";
import type { BandParams, FluidParams, GenerationParams, SkyParams } from "./types.ts";

/** Fixed bottom-edge rule from the web config (not tunable). */
interface BandRule {
    inverse: 0 | 1;
    bottomLimit: number;
}

const TUNNEL_RULE: BandRule = { inverse: 0, bottomLimit: 20 };
const CAVE_RULE: BandRule = { inverse: 1, bottomLimit: 1 };

/**
 * Skyline pass (noiseGeneration1D): one noise column per x; everything above
 * the computed height is sky, below is rock. `baseHeightPercent` scales the
 * web config's absolute BaseHeight to the map height; the four waves come
 * from `params.sky` (period in cells → frequency = 1/period, amp /100).
 */
function skylinePass(
    width: number,
    height: number,
    simplex: SimplexNoise,
    sky: SkyParams,
    baseHeightPercent: number,
    out: Uint8Array,
): void {
    const maxAmplitude = height / 4;
    const baseHeight = (baseHeightPercent / 100) * height;
    const waves = [sky.bigWave, sky.mediumWave, sky.lowWave, sky.roughness];
    for (let x = 0; x < width; x++) {
        const xx = (x + SKYLINE_FIXED.Phase) * NOISE_ZOOM_1D;
        let value = 0;
        for (const wave of waves) {
            const frequency = 1 / Math.max(1, wave.periodCells);
            value += (-0.5 + simplex.noise2D(xx * frequency, 0)) *
                SKYLINE_FIXED.Amp * (wave.amplitudePercent / 100) * maxAmplitude;
        }
        const surfaceY = Math.round(baseHeight + value);
        for (let y = 0; y < height; y++) {
            out[y * width + x] = y < surfaceY ? TERRAIN.SKY : TERRAIN.ROCK;
        }
    }
}

/**
 * 2D band pass (noiseGeneration2D): where the 4-octave noise value falls
 * inside ±Thickness, the band opens (1). Ported faithfully, including the
 * `Inverse` / `BottomLimit` bottom-edge rule.
 */
function bandPass(
    width: number,
    height: number,
    simplex: SimplexNoise,
    waves: readonly (readonly [number, number])[],
    band: BandParams,
    rule: BandRule,
    out: Uint8Array,
): void {
    const zoom = 1 - band.definitionPercent / 100;
    const thickness = band.thicknessPercent / 100;
    let total = 0;
    for (const [, amplitude] of waves) total += amplitude;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const xx = (x - band.offsetX) * NOISE_ZOOM_2D;
            const yy = (y + band.offsetY) * NOISE_ZOOM_2D;
            let value = 0;
            for (const [frequency, amplitude] of waves) {
                value += simplex.noise2D(xx * frequency * zoom, yy * frequency * zoom) *
                    amplitude;
            }
            value /= total;

            // Bottom edge handling (same reciprocal rule as the original:
            // value = 1 / ((1 / value) * edge), i.e. value / edge).
            if (y > height - rule.bottomLimit) {
                const edge = (height - y) / rule.bottomLimit;
                if (rule.inverse === 1) {
                    value *= edge + 0.1;
                } else if (edge > 0) {
                    value /= edge;
                } else {
                    value = Infinity;
                }
            }

            out[y * width + x] = value <= thickness && value >= -thickness ? 1 : 0;
        }
    }
}

/**
 * Generate the hidden terrain matrix. Deterministic for seed + size + params.
 * Codes: 0 sky, 1 rock, 2 tunnel, 3 cave.
 */
export function generateHiddenTerrain(
    seed: string,
    width: number,
    height: number,
    params: GenerationParams,
): Uint8Array {
    const simplex = new SimplexNoise(seed);
    const data = new Uint8Array(width * height);

    skylinePass(width, height, simplex, params.sky, params.baseHeightPercent, data);

    // Merge the 2D bands over the skyline result, like mapGeneration.js does.
    const tunnel = new Uint8Array(width * height);
    bandPass(width, height, simplex, TUNNEL_WAVES, params.tunnel, TUNNEL_RULE, tunnel);
    const cave = new Uint8Array(width * height);
    bandPass(width, height, simplex, CAVE_WAVES, params.cave, CAVE_RULE, cave);

    for (let i = 0; i < data.length; i++) {
        if (data[i] === TERRAIN.SKY) continue;
        if (tunnel[i] === 1) data[i] = TERRAIN.TUNNEL;
        else if (cave[i] === 1) data[i] = TERRAIN.CAVE;
    }

    // Fluid fill step (mapGeneration.js step 4) — optional, driven by params.fluid.
    // The web generator bakes these as GPU kernels; here it's a CPU flood-fill.
    const fp = params.fluid;
    if (fp.fogWaterFlowIterations > 0) {
        fogWaterFill(data, width, height, TERRAIN.TUNNEL, TERRAIN.CAVE, fp);
    }
    if (fp.lavaFlowIterations > 0) {
        lavaFill(data, width, height, TERRAIN.TUNNEL, TERRAIN.CAVE, fp);
    }
    if (fp.surfaceWaterFillIterations > 0) {
        surfaceWaterFill(data, width, height, fp);
    }

    return data;
}

// ---------------------------------------------------------------------------
// Fluid Generation (mapGeneration.js step 4) — CPU port of the GPU kernels.
// Each `convPropagat*StepX` kernel is ported to a scan over the matrix; water
// and lava fill tunnels/caves from the bottom / spread horizontally, surface
// water pools under open sky, then pool-size pruning drains small/large pools.
// ---------------------------------------------------------------------------

const WATER_DIST = 1024;

/** Underground water (Fog) fill — ports `convPropagatWaterStepA`/`StepB` + pruning. */
function fogWaterFill(
    data: Uint8Array,
    width: number,
    height: number,
    tunnelCode: number,
    caveCode: number,
    p: FluidParams,
): void {
    const dist = new Uint16Array(data.length).fill(0);

    // Step A — flow + pool grow: water enters tunnel/cave from below.
    // The GPU kernel seeds water at the bottom of a tunnel/cave (rock below)
    // with dist=1024, then propagates upward (and sideways) each iteration.
    for (let iter = 0; iter < p.fogWaterFlowIterations; iter++) {
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const c = data[i];
                if (c === tunnelCode || c === caveCode) {
                    // Seed: tunnel/cave with rock below → water entry point
                    const belowIdx = y < height - 1 ? (y + 1) * width + x : -1;
                    const belowC = belowIdx >= 0 ? data[belowIdx] : 0;
                    const belowDist = belowIdx >= 0 ? dist[belowIdx] : 0;
                    if (belowC === TERRAIN.ROCK && belowDist === 0) {
                        dist[i] = WATER_DIST; // 1024 — initial seed
                    } else if (belowDist >= WATER_DIST) {
                        dist[i] = belowDist + 1;
                    }
                    // Horizontal spread: take the lower distance from neighbors
                    if (dist[i] >= WATER_DIST) {
                        const lIdx = x > 0 ? i - 1 : -1;
                        const rIdx = x < width - 1 ? i + 1 : -1;
                        const lDist = lIdx >= 0 ? dist[lIdx] : 0;
                        const rDist = rIdx >= 0 ? dist[rIdx] : 0;
                        if (lDist >= WATER_DIST && lDist < dist[i]) dist[i] = lDist;
                        if (rDist >= WATER_DIST && rDist < dist[i]) dist[i] = rDist;
                    }
                }
            }
        }
    }

    // Step B — column prune: remove water not connected to open space.
    for (let iter = 0; iter < p.fogWaterPruneIterations; iter++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (dist[i] < WATER_DIST) continue;
                const l = x > 0 ? data[y * width + x - 1] : 0;
                const r = x < width - 1 ? data[y * width + x + 1] : 0;
                const d = y < height - 1 ? data[(y + 1) * width + x] : 0;
                if (
                    l === tunnelCode || l === caveCode || l === TERRAIN.SKY ||
                    r === tunnelCode || r === caveCode || r === TERRAIN.SKY ||
                    d === tunnelCode || d === caveCode || d === TERRAIN.SKY
                ) {
                    dist[i] = 0;
                }
            }
        }
    }

    // Pool-size pruning: only keep pools within [min, max] cell count.
    const poolSize = dist.reduce((sum, v) => sum + (v >= WATER_DIST ? 1 : 0), 0);
    if (poolSize >= p.fogWaterMinPoolSize && poolSize <= p.fogWaterMaxPoolSize) {
        for (let i = 0; i < data.length; i++) {
            if (
                (data[i] === tunnelCode || data[i] === caveCode) &&
                dist[i] >= WATER_DIST
            ) {
                data[i] = TERRAIN.WATER;
            }
        }
    }
    void tunnelCode;
    void caveCode;
}

/** Lava fill — ports `convPropagateLavaStepA`/`StepB` + pruning. */
function lavaFill(
    data: Uint8Array,
    width: number,
    height: number,
    tunnelCode: number,
    caveCode: number,
    p: FluidParams,
): void {
    const dist = new Uint16Array(data.length).fill(0);

    // Step A — lava sinks to the bottom of tunnels/caves.
    for (let iter = 0; iter < p.lavaFlowIterations; iter++) {
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                const c = data[i];
                if (c === tunnelCode || c === caveCode) {
                    if (y === height - 1) dist[i] = WATER_DIST;
                    else {
                        const below = dist[(y + 1) * width + x];
                        const left = x > 0 ? dist[y * width + x - 1] : 0;
                        const right = x < width - 1 ? dist[y * width + x + 1] : 0;
                        if (below >= WATER_DIST || left >= WATER_DIST || right >= WATER_DIST) {
                            dist[i] = WATER_DIST;
                        }
                    }
                }
            }
        }
    }
    // Step B — horizontal spread (lava climbs walls).
    for (let iter = 0; iter < p.lavaSpreadIterations; iter++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (data[i] !== tunnelCode && data[i] !== caveCode) continue;
                if (dist[i] < WATER_DIST) {
                    const l = x > 0 ? dist[y * width + x - 1] : 0;
                    const r = x < width - 1 ? dist[y * width + x + 1] : 0;
                    if (l >= WATER_DIST || r >= WATER_DIST) dist[i] = WATER_DIST;
                }
            }
        }
    }
    const poolSize = dist.reduce((sum, v) => sum + (v >= WATER_DIST ? 1 : 0), 0);
    if (poolSize >= p.lavaMinPoolSize && poolSize <= p.lavaMaxPoolSize) {
        for (let i = 0; i < data.length; i++) {
            if (
                (data[i] === tunnelCode || data[i] === caveCode) &&
                dist[i] >= WATER_DIST
            ) {
                data[i] = TERRAIN.LAVA;
            }
        }
    }
    void tunnelCode;
    void caveCode;
}

/** Surface water fill — ports `convPropagatSurfaceWaterStepA`/`StepB` + pruning. */
function surfaceWaterFill(
    data: Uint8Array,
    width: number,
    height: number,
    p: FluidParams,
): void {
    const dist = new Uint16Array(data.length).fill(0);

    // Step A — water pools on sky cells sitting on rock/cave.
    for (let iter = 0; iter < p.surfaceWaterFillIterations; iter++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (data[i] !== TERRAIN.SKY) continue;
                const below = y < height - 1 ? data[(y + 1) * width + x] : 0;
                if (below === TERRAIN.ROCK || below === TERRAIN.CAVE) {
                    dist[i] = WATER_DIST;
                }
            }
        }
    }
    // Step B — pull back edges: water touching tunnel/sky drains.
    for (let iter = 0; iter < p.surfaceWaterEdgeIterations; iter++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (dist[i] < WATER_DIST) continue;
                const l = x > 0 ? data[y * width + x - 1] : 0;
                const r = x < width - 1 ? data[y * width + x + 1] : 0;
                const d = y < height - 1 ? data[(y + 1) * width + x] : 0;
                if (
                    l === TERRAIN.TUNNEL || l === TERRAIN.SKY ||
                    r === TERRAIN.TUNNEL || r === TERRAIN.SKY ||
                    d === TERRAIN.TUNNEL || d === TERRAIN.SKY
                ) {
                    dist[i] = 0;
                }
            }
        }
    }
    const poolSize = dist.reduce((sum, v) => sum + (v >= WATER_DIST ? 1 : 0), 0);
    if (poolSize >= p.surfaceWaterMinSize && poolSize <= p.surfaceWaterMaxSize) {
        for (let i = 0; i < data.length; i++) {
            if (dist[i] >= WATER_DIST && data[i] === TERRAIN.SKY) {
                data[i] = TERRAIN.SURFACE_WATER;
            }
        }
    }
}
