/**
 * JsonMapBuffer example — versioned JSON PLUS atomic per-path counters.
 *
 * Every numeric leaf of the default record is auto-discovered and mirrored into
 * its own tiny shared buffer `${key}:map:<path>` with a per-path LOG:
 *
 *   [0] = log  (bumped every time that counter changes — see log(path))
 *   [1] = value (atomically read/written; increment() uses a CAS loop)
 *
 * This makes a worker's `+1` RACE-FREE even with concurrent writers — no lost
 * update, no compare-and-swap-fail — because the value lives in an Int32Array
 * and is bumped with Atomics, not by decoding/re-encoding the whole JSON.
 *
 * Run from the repo root with the workspace config:
 *   deno run --config ./deno.json packages/buffer/exemple/jsonMapBuffer/main.ts
 */

import { JsonMapBuffer } from "@sandmd/buffer";

const MOD_ID = "buffer-map-example";
const KEY = `${MOD_ID}:gameState`;

interface GameState {
    score: number;
    kills: number;
    label: string;
    players: { name: string; score: number }[];
}

function main() {
    // `score` and `kills` are explicitly mapped to atomic counters.
    // `players[].score` is an array-template and stays in JSON; map a specific
    // array element explicitly when it needs atomic updates.
    const state = new JsonMapBuffer<GameState>({
        modId: MOD_ID,
        key: KEY,
        defaultRecord: {
            score: 0,
            kills: 0,
            label: "new game",
            players: [{ name: "Ada", score: 5 }],
        },
        maxBytes: 64 * 1024,
        counters: {
            score: { min: -2147483648, max: 2147483647 },
            kills: { min: 0, max: 999 },
        },
        persist: false,
        loadFromStorage: false,
    });

    console.log("mapped counters:", state.counterPaths());
    console.log("isCounter('score')   :", state.isCounter("score"));
    console.log("isCounter('label')   :", state.isCounter("label"));

    // A worker bumps the counter directly through the shared Int32Array.
    // CAS loop => safe even if two workers bump at the same time.
    state.increment("score", 1); // 0 -> 1
    state.increment("score", 4); // 1 -> 5
    state.increment("kills", 1); // 0 -> 1
    state.increment("kills", 1); // 1 -> 2 (clamped by max 999)
    console.log("score:", state.getPath("score"), "kills:", state.getPath("kills"));
    console.log("logs  :", state.logs());

    // Counter writes also publish to the record when you commit().
    state.setPath("label", "round 2"); // JSON-only leaf
    state.commit();
    console.log("== after commit() ==");
    console.log("get():", state.get());
    console.log("score raw:", state.getPath("score"), "label:", state.getPath("label"));

    // A second instance sees the SAME shared counters instantly (no re-encode).
    const observer = new JsonMapBuffer<GameState>({
        modId: MOD_ID,
        key: KEY,
        defaultRecord: { score: 0, kills: 0, label: "", players: [] },
        maxBytes: 64 * 1024,
        counters: {
            score: { min: -2147483648, max: 2147483647 },
            kills: { min: 0, max: 999 },
        },
        persist: false,
        loadFromStorage: false,
    });
    console.log(
        "observer sees score:",
        observer.getPath("score"),
        "kills:",
        observer.getPath("kills"),
    );
}

try {
    void main();
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
    console.error(e);
}
