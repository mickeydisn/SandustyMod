/**
 * Hidden World — the hidden terrain generator.
 *
 * Port of the sandgenerator-web "first step": seeded simplex noise
 * (skyline 1D + tunnel/cave 2D bands) merged into one terrain matrix, exactly
 * like `noiseGeneration1D.js` / `noiseGeneration2D.js` / `mapGeneration.js`.
 * Tunables come from `GenerationParams` (percents); wave sets and bottom-edge
 * rules stay fixed like the web config. Pure functions only.
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
import type { BandParams, GenerationParams, SkyParams } from "./types.ts";

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
    return data;
}
