/**
 * Multi-stage hidden terrain generator — rewritten to match sandgenerator-web intent.
 *
 * Coordinate system: y = 0 is TOP (sky), y increases downward (same as web / canvas).
 *
 * Stage 1 — Noise: skyline + tunnel + cave (cave uses Inverse band, like CaveGenerator2D)
 * Stage 2 — Sky-distance + seal: only close tunnel/cave NEVER reached from sky
 * Stage 3 — Fluids: floor-anchored columns, spill removal → clean enclosed pools only
 * Stage 4 — Wall grow: moss/grass/redsand by sky-distance (not raw Y)
 * Stage 5 — Form grow: patches in sky-distance bands
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

// ---------------------------------------------------------------------------
// Stage 1 — noise
// ---------------------------------------------------------------------------

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
    // Web noiseGeneration1D: (BaseHeight + value > y) ? sky : rock
    // y=0 is TOP (canvas). Sky when surface level is below this row.
    const surface = baseHeight + value;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = surface > y ? TERRAIN.SKY : TERRAIN.ROCK;
    }
  }
}

/**
 * 2D band pass matching NoiseGenerator2D / CaveGenerator2D.
 *
 * inverse = 0 (tunnel): open when |noise| <= thickness
 * inverse = 1 (cave):   open when |noise| is OUTSIDE the thinned band
 *                       (thickness effective = 0.5 - thicknessPercent/100)
 */
function bandPass(
  width: number,
  height: number,
  simplex: SimplexNoise,
  waves: readonly (readonly [number, number])[],
  band: BandParams,
  inverse: 0 | 1,
  bottomLimit: number,
  out: Uint8Array,
): void {
  const zoom = 1 - band.definitionPercent / 100;
  const rawT = band.thicknessPercent / 100;
  const thickness = inverse ? Math.max(0.01, 0.5 - rawT) : rawT;

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

      if (y > height - bottomLimit) {
        const edge = (height - y) / bottomLimit;
        if (inverse === 1) {
          value *= edge + 0.1;
        } else if (edge > 0) {
          value = value / edge;
        } else {
          value = Infinity;
        }
      }

      const inBand = value <= thickness && value >= -thickness;
      const isOpen = inverse === 0 ? inBand : !inBand;
      out[y * width + x] = isOpen ? 1 : 0;
    }
  }
}

function stageNoise(
  width: number,
  height: number,
  simplex: SimplexNoise,
  params: GenerationParams,
  data: Uint8Array,
): void {
  skylinePass(width, height, simplex, params.sky, params.baseHeightPercent, data);

  if (params.tunnel.enabled) {
    const tunnel = new Uint8Array(width * height);
    bandPass(width, height, simplex, TUNNEL_WAVES, params.tunnel, 0, 20, tunnel);
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== TERRAIN.SKY && tunnel[i] === 1) data[i] = TERRAIN.TUNNEL;
    }
  }

  if (params.cave.enabled) {
    const cave = new Uint8Array(width * height);
    bandPass(width, height, simplex, CAVE_WAVES, params.cave, 1, 1, cave);
    for (let i = 0; i < data.length; i++) {
      if (
        (data[i] === TERRAIN.ROCK || data[i] === TERRAIN.TUNNEL) &&
        cave[i] === 1
      ) {
        data[i] = TERRAIN.CAVE;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 2 — sky-distance + seal
// ---------------------------------------------------------------------------

/**
 * BFS distance from sky into tunnel/cave only (rock is a barrier).
 * dist = 1 at void cells bordering sky, then increases deeper.
 * dist = -1 → never reached from sky → sealed to rock.
 * Reachable voids are left untouched.
 */
function stageSeal(
  width: number,
  height: number,
  data: Uint8Array,
  seal: GenerationParams["seal"],
): Int16Array {
  const n = width * height;
  const dist = new Int16Array(n);
  dist.fill(-1);

  const isVoid = (c: number) => {
    if (c === TERRAIN.TUNNEL && seal.sealTunnels) return true;
    if (c === TERRAIN.CAVE && seal.sealCaves) return true;
    // still walk through voids even if we won't seal that type
    return c === TERRAIN.TUNNEL || c === TERRAIN.CAVE;
  };
  const canSeal = (c: number) =>
    (c === TERRAIN.TUNNEL && seal.sealTunnels) ||
    (c === TERRAIN.CAVE && seal.sealCaves);

  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const trySeed = (i: number) => {
    if (dist[i]! >= 0) return;
    if (!isVoid(data[i]!)) return;
    dist[i] = 1;
    queue[tail++] = i;
  };

  for (let i = 0; i < n; i++) {
    if (data[i] !== TERRAIN.SKY) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) trySeed(i - 1);
    if (x < width - 1) trySeed(i + 1);
    if (y > 0) trySeed(i - width);
    if (y < height - 1) trySeed(i + width);
    if (seal.diagonal) {
      if (x > 0 && y > 0) trySeed(i - width - 1);
      if (x < width - 1 && y > 0) trySeed(i - width + 1);
      if (x > 0 && y < height - 1) trySeed(i + width - 1);
      if (x < width - 1 && y < height - 1) trySeed(i + width + 1);
    }
  }

  const stepCap = Math.max(n, seal.maxIterations * Math.max(width, height));
  let steps = 0;
  while (head < tail && steps < stepCap) {
    const i = queue[head++]!;
    const d = dist[i]! + 1;
    const x = i % width;
    const y = (i / width) | 0;
    const neigh = [i - 1, i + 1, i - width, i + width];
    if (seal.diagonal) {
      neigh.push(i - width - 1, i - width + 1, i + width - 1, i + width + 1);
    }
    for (const j of neigh) {
      if (j < 0 || j >= n) continue;
      const jx = j % width;
      // no horizontal wrap
      if (Math.abs(jx - x) > 1) continue;
      if (dist[j]! >= 0) continue;
      if (!isVoid(data[j]!)) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
    steps++;
  }

  if (seal.enabled) {
    // Surface band: top surfaceKeepPercent of height — don't seal voids there
    const keepY = Math.floor((seal.surfaceKeepPercent / 100) * height);
    for (let i = 0; i < n; i++) {
      if (dist[i]! >= 0) continue; // reached from sky
      if (!canSeal(data[i]!)) continue;
      const y = (i / width) | 0;
      if (y < keepY) continue; // keep near-surface cracks
      data[i] = TERRAIN.ROCK;
    }
  }

  for (let i = 0; i < n; i++) {
    if (data[i] === TERRAIN.SKY) dist[i] = 0;
  }
  return dist;
}


// ---------------------------------------------------------------------------
// Stage 3 — fluids (enclosed pools only)
// ---------------------------------------------------------------------------

/**
 * Floor-anchored columns + spill removal → liquid only in closed basins.
 * No floating liquid, no liquid open to sky.
 */
/**
 * Fluids — depth-based enclosed pools (works after seal).
 *
 * Why the old "spill to sky" approach produced zero water:
 *   after seal, every remaining void is reachable from sky, so path-based
 *   drain removed every candidate.
 *
 * New approach (matches web intent: floor columns in deep voids):
 *   1. In each column, find open (tunnel/cave) runs sitting on ROCK floor
 *   2. Require sky-distance at the floor >= minDist (deep enough / not a surface crack)
 *   3. Fill only the bottom portion of the run (flat pool under air)
 *   4. Surface water: sky cells with rock within N cells below
 */
function stageFluids(
  width: number,
  height: number,
  data: Uint8Array,
  dist: Int16Array | null,
  params: GenerationParams["fluids"],
): void {
  if (!params.enabled) return;

  const n = width * height;
  const isOpen = (c: number) => c === TERRAIN.TUNNEL || c === TERRAIN.CAVE;
  const dAt = (i: number) => (dist ? dist[i]! : 999);

  // ---- Underground pools (water / lava) ----
  if (params.water || params.lava) {
    // Min sky-distance so pools sit away from surface openings.
    // Keep thresholds modest: after seal, deep cells still have moderate dist.
    const waterMinDist = Math.max(4, params.waterMinDepth);
    const lavaMinDist = Math.max(waterMinDist + 15, params.lavaMinDepth * 2);

    for (let x = 0; x < width; x++) {
      let y = height - 1;
      while (y >= 0) {
        const i = y * width + x;
        const c = data[i]!;

        // Need open cell with ROCK directly below (floor)
        const below = y + 1 < height ? data[(y + 1) * width + x]! : TERRAIN.ROCK;
        if (!isOpen(c) || below !== TERRAIN.ROCK) {
          y--;
          continue;
        }

        // Walk up the open column from this floor
        let top = y;
        while (top > 0) {
          const above = data[(top - 1) * width + x]!;
          if (!isOpen(above) && above !== TERRAIN.FOG_WATER && above !== TERRAIN.FOG_LAVA) {
            break;
          }
          top--;
        }
        // open run is [top .. y] inclusive, floor at y+1
        const runH = y - top + 1;
        const floorDist = dAt(i);

        // Decide liquid type from depth + run height
        let code = 0;
        let minH = 0;
        if (params.lava && runH >= params.lavaMinDepth && floorDist >= lavaMinDist) {
          code = TERRAIN.FOG_LAVA;
          minH = params.lavaMinDepth;
        } else if (params.water && runH >= params.waterMinDepth && floorDist >= waterMinDist) {
          code = TERRAIN.FOG_WATER;
          minH = params.waterMinDepth;
        }

        if (code) {
          // Flat pool: fill bottom ~half of the run (leave air under ceiling)
          const fillH = Math.max(minH, Math.floor(runH * 0.5));
          const fillTop = Math.max(top, y - fillH + 1);
          for (let fy = fillTop; fy <= y; fy++) {
            const fi = fy * width + x;
            if (isOpen(data[fi]!)) data[fi] = code;
          }
        }

        // Continue above this run
        y = top - 1;
      }
    }
  }

  // ---- Surface water: sky sitting on rock ----
  if (params.surfaceWater) {
    const maxD = Math.max(1, params.surfaceWaterDepth);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const i = y * width + x;
        if (data[i] !== TERRAIN.SKY) continue;
        // rock within maxD cells below, only sky in between
        let ok = false;
        for (let dy = 1; dy <= maxD; dy++) {
          const j = (y + dy) * width + x;
          if (j >= n) break;
          const c = data[j]!;
          if (c === TERRAIN.ROCK || c === TERRAIN.GRASS) {
            ok = true;
            break;
          }
          if (c !== TERRAIN.SKY) break;
        }
        if (ok) data[i] = TERRAIN.SURFACE_WATER;
      }
    }
  }
}

/**
 * Wall grow — rule list (sandgenerator WallGrow).
 *
 * For each enabled rule:
 *  1) Seed: cell in typeToReplace, sky-dist in [min, min+thickness],
 *     and a neighbor on a nearMask side matches inBorderOf.
 *  2) Grow: growSize full iterations expanding 4-way into typeToReplace
 *     (still inside the distance band). This is the missing multi-layer grow.
 *
 * Bounds = axis-aligned rect as % of full map width/height.
 */

function stageWallGrow(
  width: number,
  height: number,
  data: Uint8Array,
  dist: Int16Array | null,
  params: GenerationParams["wallGrow"],
): void {
  if (!params.enabled || !params.rules?.length) return;
  const n = width * height;
  for (const rule of params.rules) {
    if (!rule.enabled) continue;

    const grow = Math.max(0, Math.min(32, rule.growSize | 0));
    const marks = new Uint8Array(n); // 1 = seed/grown for this rule

    const inBorder = new Set(rule.inBorderOf);
    const replaceable = new Set(rule.typeToReplace);
    const [maskU, maskR, maskD, maskL] = rule.nearMask;
    const b = rule.bounds;
    const y0 = Math.floor((Math.min(b.top, b.bottom) / 100) * height);
    const y1 = Math.ceil((Math.max(b.top, b.bottom) / 100) * height);
    const x0 = Math.floor((Math.min(b.left, b.right) / 100) * width);
    const x1 = Math.ceil((Math.max(b.left, b.right) / 100) * width);
    const inBounds = (x: number, y: number) =>
      x >= x0 && x < x1 && y >= y0 && y < y1;

    // --- 1) Seed ---
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!replaceable.has(data[i]!)) continue;
        if (!inBounds(x, y)) continue;

        const up = data[i - width]!;
        const rt = data[i + 1]!;
        const dn = data[i + width]!;
        const lf = data[i - 1]!;

        let hit = false;
        if (maskU && inBorder.has(up)) hit = true;
        if (maskR && inBorder.has(rt)) hit = true;
        if (maskD && inBorder.has(dn)) hit = true;
        if (maskL && inBorder.has(lf)) hit = true;
        if (!hit) continue;

        marks[i] = 1;
      }
    }

    // --- 2) Grow iterations (full 4-connected into typeToReplace) ---
    for (let g = 0; g < grow; g++) {
      const next = new Uint8Array(marks);
      let added = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (marks[i]) continue;
          if (!replaceable.has(data[i]!)) continue;
          if (!inBounds(x, y)) continue;

          if (
            marks[i - 1] || marks[i + 1] ||
            marks[i - width] || marks[i + width]
          ) {
            next[i] = 1;
            added++;
          }
        }
      }
      marks.set(next);
      if (added === 0) break;
    }

    // --- 3) Apply ---
    for (let i = 0; i < n; i++) {
      if (marks[i]) data[i] = rule.replaceBy;
    }
  }
}

/**
 * Form grow — rule list (sandgenerator FormeGrow approx).
 * Seed by noise inside distance band on inBorderOf cells, then grow.
 */
function stageFormGrow(
  width: number,
  height: number,
  data: Uint8Array,
  dist: Int16Array | null,
  simplex: SimplexNoise,
  params: GenerationParams["formGrow"],
): void {
  if (!params.enabled || !dist || !params.rules?.length) return;
  const n = width * height;

  for (const rule of params.rules) {
    if (!rule.enabled) continue;

    const grow = Math.max(0, Math.min(32, rule.growSize | 0));
    const targets = new Set(rule.inBorderOf);
    const marks = new Uint8Array(n);
    const b = rule.bounds;
    const y0 = Math.floor((Math.min(b.top, b.bottom) / 100) * height);
    const y1 = Math.ceil((Math.max(b.top, b.bottom) / 100) * height);
    const x0 = Math.floor((Math.min(b.left, b.right) / 100) * width);
    const x1 = Math.ceil((Math.max(b.left, b.right) / 100) * width);
    const inBounds = (x: number, y: number) =>
      x >= x0 && x < x1 && y >= y0 && y < y1;

    for (let i = 0; i < n; i++) {
      if (!targets.has(data[i]!)) continue;
      const x = i % width;
      const y = (i / width) | 0;
      if (!inBounds(x, y)) continue;
      // scatterPercent 0→100 maps to threshold 0.95→-0.2 (more seeds when higher)
      const scatter = Math.min(100, Math.max(0, rule.scatterPercent ?? 35));
      const threshold = 0.95 - (scatter / 100) * 1.15;
      if (simplex.noise2D(x * 0.05 + rule.replaceBy, y * 0.05) > threshold) {
        marks[i] = 1;
      }
    }

    for (let g = 0; g < grow; g++) {
      const next = new Uint8Array(marks);
      let added = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (marks[i]) continue;
          if (!targets.has(data[i]!)) continue;
          if (!inBounds(x, y)) continue;
          if (
            marks[i - 1] || marks[i + 1] ||
            marks[i - width] || marks[i + width]
          ) {
            next[i] = 1;
            added++;
          }
        }
      }
      marks.set(next);
      if (added === 0) break;
    }

    for (let i = 0; i < n; i++) {
      if (marks[i]) data[i] = rule.replaceBy;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateResult {
  data: Uint8Array;
  skyDistance: Int16Array | null;
}

export type GenerateProgress = (stage: string, percent: number) => void;

export function generateHiddenTerrain(
  seed: string,
  width: number,
  height: number,
  params: GenerationParams,
  onProgress?: GenerateProgress,
): GenerateResult {
  const report = (stage: string, percent: number) => {
    try { onProgress?.(stage, percent); } catch { /* */ }
  };

  const simplex = new SimplexNoise(seed);
  const data = new Uint8Array(width * height);

  report("Skyline + tunnels + caves…", 5);
  stageNoise(width, height, simplex, params, data);
  report("Noise merge done", 25);

  report(
    params.seal.enabled
      ? "Sky-distance + seal unreachable voids…"
      : "Sky-distance only (seal off)…",
    30,
  );
  const skyDistance = stageSeal(width, height, data, params.seal);
  report(params.seal.enabled ? "Seal done" : "Distance done", 50);

  if (params.fluids.enabled) {
    report("Fluids (enclosed pools only)…", 55);
    stageFluids(width, height, data, skyDistance, params.fluids);
    report("Fluids done", 70);
  } else {
    report("Fluids skipped", 70);
  }

  if (params.wallGrow.enabled) {
    report("Wall grow (moss / grass / redsand)…", 75);
    stageWallGrow(width, height, data, skyDistance, params.wallGrow);
    report("Wall grow done", 85);
  } else {
    report("Wall grow skipped", 85);
  }

  if (params.formGrow.enabled) {
    report("Form grow (spore / frost / crackstone)…", 88);
    stageFormGrow(width, height, data, skyDistance, simplex, params.formGrow);
    report("Form grow done", 95);
  } else {
    report("Form grow skipped", 95);
  }

  report("Building ghost cache…", 98);
  return { data, skyDistance };
}
