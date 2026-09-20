/**
 * Smoke test for the hidden terrain generator (dev only, not part of the mod).
 * Run: deno run mods/hidden-word/tools/smokeTerrain.ts
 */

import { DEFAULT_PARAMS, TERRAIN } from "../src/constants.ts";
import { generateHiddenTerrain } from "../src/terrain.ts";

function distribution(data: Uint8Array): string {
    const counts = new Map<number, number>();
    for (const code of data) counts.set(code, (counts.get(code) ?? 0) + 1);
    return [0, 1, 2, 3].map((code) =>
        `${code}:${((counts.get(code) ?? 0) / data.length * 100).toFixed(1)}%`
    ).join(" ");
}

// Small map: deterministic + all codes present.
const a = generateHiddenTerrain("deadbeef", 320, 320, DEFAULT_PARAMS);
const b = generateHiddenTerrain("deadbeef", 320, 320, DEFAULT_PARAMS);
let same = true;
for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
        same = false;
        break;
    }
}
console.log("deterministic:", same);
console.log("small 320x320 →", distribution(a));

const codes = new Set(a);
console.log(
    "has sky/rock/tunnel/cave:",
    codes.has(TERRAIN.SKY) && codes.has(TERRAIN.ROCK) &&
        codes.has(TERRAIN.TUNNEL) && codes.has(TERRAIN.CAVE),
);

// Large map timing (worst realistic case).
const t0 = performance.now();
const big = generateHiddenTerrain("deadbeef", 2048, 1024, DEFAULT_PARAMS);
console.log(`2048x1024 in ${(performance.now() - t0).toFixed(0)}ms`);
console.log("big →", distribution(big));
