import {
  CAVE_WAVES,
  NOISE_ZOOM_1D,
  NOISE_ZOOM_2D,
  SKYLINE_FIXED,
  TERRAIN,
  TUNNEL_WAVES,
} from "../world/constants.ts";
import { SimplexNoise } from "./noise.ts";
import type { BandParams, FormModifier, GenerationParams, LiquidModifier, SkyParams, WallModifier } from "../world/types.ts";

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
    if (false /* diagonal removed */) {
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
    if (false /* diagonal removed */) {
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
    const keepY = 0; // surface keep hardcoded off
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
function inMapBounds(
  x: number, y: number, width: number, height: number,
  b: { top: number; bottom: number; left: number; right: number },
): boolean {
  const y0 = Math.floor((Math.min(b.top, b.bottom) / 100) * height);
  const y1 = Math.ceil((Math.max(b.top, b.bottom) / 100) * height);
  const x0 = Math.floor((Math.min(b.left, b.right) / 100) * width);
  const x1 = Math.ceil((Math.max(b.left, b.right) / 100) * width);
  return x >= x0 && x < x1 && y >= y0 && y < y1;
}

function stageLiquid(
  width: number,
  height: number,
  data: Uint8Array,
  dist: Int16Array | null,
  mod: LiquidModifier,
): void {
  if (!mod.enabled) return;

  const n = width * height;
  const isOpen = (c: number) => c === TERRAIN.TUNNEL || c === TERRAIN.CAVE;
  const dAt = (i: number) => (dist ? dist[i]! : 999);
  const b = mod.bounds;
  const minDepth = Math.max(1, mod.minDepth | 0);

  if (mod.liquidType === "water" || mod.liquidType === "lava") {
    const code = mod.liquidType === "lava" ? TERRAIN.FOG_LAVA : TERRAIN.FOG_WATER;
    const minDist = mod.liquidType === "lava" ? Math.max(minDepth + 10, minDepth * 2) : minDepth;

    for (let x = 0; x < width; x++) {
      let y = height - 1;
      while (y >= 0) {
        const i = y * width + x;
        const c = data[i]!;
        const below = y + 1 < height ? data[(y + 1) * width + x]! : TERRAIN.ROCK;
        if (!isOpen(c) || below !== TERRAIN.ROCK || !inMapBounds(x, y, width, height, b)) {
          y--;
          continue;
        }

        let top = y;
        while (top > 0) {
          const above = data[(top - 1) * width + x]!;
          if (!isOpen(above) && above !== TERRAIN.FOG_WATER && above !== TERRAIN.FOG_LAVA) break;
          top--;
        }
        const runH = y - top + 1;
        const floorDist = dAt(i);

        if (runH >= minDepth && floorDist >= minDist) {
          const fillH = Math.max(minDepth, Math.floor(runH * 0.5));
          const fillTop = Math.max(top, y - fillH + 1);
          for (let fy = fillTop; fy <= y; fy++) {
            if (!inMapBounds(x, fy, width, height, b)) continue;
            const fi = fy * width + x;
            if (isOpen(data[fi]!)) data[fi] = code;
          }
        }
        y = top - 1;
      }
    }
    return;
  }

  // surface water
  if (mod.liquidType === "surface") {
    const maxD = minDepth;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!inMapBounds(x, y, width, height, b)) continue;
        const i = y * width + x;
        if (data[i] !== TERRAIN.SKY) continue;
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
 * Wall grow — single modifier (sandgenerator WallGrow).
 */
function stageWallGrow(
  width: number,
  height: number,
  data: Uint8Array,
  _dist: Int16Array | null,
  rule: WallModifier,
): void {
  if (!rule.enabled) return;
  const n = width * height;
  const grow = Math.max(0, Math.min(32, rule.growSize | 0));
  const marks = new Uint8Array(n);
  const inBorder = new Set(rule.inBorderOf);
  const replaceable = new Set(rule.typeToReplace);
  const [maskU, maskR, maskD, maskL] = rule.nearMask;
  const b = rule.bounds;
  const y0 = Math.floor((Math.min(b.top, b.bottom) / 100) * height);
  const y1 = Math.ceil((Math.max(b.top, b.bottom) / 100) * height);
  const x0 = Math.floor((Math.min(b.left, b.right) / 100) * width);
  const x1 = Math.ceil((Math.max(b.left, b.right) / 100) * width);
  const inBounds = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

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

  for (let g = 0; g < grow; g++) {
    const next = new Uint8Array(marks);
    let added = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (marks[i]) continue;
        if (!replaceable.has(data[i]!)) continue;
        if (!inBounds(x, y)) continue;
        if (marks[i - 1] || marks[i + 1] || marks[i - width] || marks[i + width]) {
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

/**
 * Form grow — single modifier.
 */
function stageFormGrow(
  width: number,
  height: number,
  data: Uint8Array,
  dist: Int16Array | null,
  simplex: SimplexNoise,
  rule: FormModifier,
): void {
  if (!rule.enabled || !dist) return;
  const n = width * height;
  const grow = Math.max(0, Math.min(32, rule.growSize | 0));
  const targets = new Set(rule.inBorderOf);
  const marks = new Uint8Array(n);
  const b = rule.bounds;
  const y0 = Math.floor((Math.min(b.top, b.bottom) / 100) * height);
  const y1 = Math.ceil((Math.max(b.top, b.bottom) / 100) * height);
  const x0 = Math.floor((Math.min(b.left, b.right) / 100) * width);
  const x1 = Math.ceil((Math.max(b.left, b.right) / 100) * width);
  const inBounds = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const scatter = Math.min(100, Math.max(0, rule.scatterPercent ?? 35));
  const threshold = 0.95 - (scatter / 100) * 1.15;

  for (let i = 0; i < n; i++) {
    if (!targets.has(data[i]!)) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (!inBounds(x, y)) continue;
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
        if (marks[i - 1] || marks[i + 1] || marks[i - width] || marks[i + width]) {
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

  const mods = params.modifiers ?? [];
  const nMods = Math.max(1, mods.length);
  for (let mi = 0; mi < mods.length; mi++) {
    const mod = mods[mi]!;
    if (!mod.enabled) {
      report(`Skip ${mod.name}`, 50 + Math.round(((mi + 1) / nMods) * 45));
      continue;
    }
    const pct = 50 + Math.round(((mi + 0.5) / nMods) * 45);
    if (mod.kind === "liquid") {
      report(`Liquid: ${mod.name}…`, pct);
      stageLiquid(width, height, data, skyDistance, mod);
    } else if (mod.kind === "wall") {
      report(`Wall: ${mod.name}…`, pct);
      stageWallGrow(width, height, data, skyDistance, mod);
    } else if (mod.kind === "form") {
      report(`Form: ${mod.name}…`, pct);
      stageFormGrow(width, height, data, skyDistance, simplex, mod);
    }
    report(`${mod.name} done`, 50 + Math.round(((mi + 1) / nMods) * 45));
  }

  report("Building ghost cache…", 98);
  return { data, skyDistance };
}
