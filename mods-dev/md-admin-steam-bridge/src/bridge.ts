/**
 * md-admin-steam-bridge — the `globalThis.__sk` command surface.
 *
 * ## Why this exists
 *
 * The host injects `sandkit` as a **parameter** of the wrapper it builds for
 * every mod (see `external-mod-runtime.js` in the game's bundle):
 *
 * ```js
 * new Function("__sandkit", `"use strict";\nconst sandkit = __sandkit;\n` +
 *              `return (async () => {\n${entrySource}\n})();`)
 * ```
 *
 * So it is on neither `window` nor `globalThis`, and a CDP
 * `Runtime.evaluate` — which runs in global scope — cannot reach it. This file
 * hands the outside world **closures that already have it**, which is the only
 * way to drive a running game from a terminal.
 *
 * ## Why there is no `eval` here
 *
 * An earlier version used a direct `eval` to escape the scope. It made the mod
 * **fail to load entirely and silently** — no log line, no exception, nothing,
 * while every other mod loaded normally. The entry is compiled through
 * `new Function` under a CSP that refuses string evaluation, and the host
 * swallows the failure.
 *
 * `new Function` *is* permitted — the host itself uses it for every mod — which
 * is why `attachProcess` can take a callback body as a string. Keep the
 * distinction clear: `eval` is blocked, `new Function` is not.
 */

import "@sandmd/sandkit";

/** The store subtree, once. `sandkit.state` is not on the `api` namespace. */
const store = (sandkit as { state?: { store?: Record<string, any> } }).state?.store;
const api = sandkit.api as unknown as Record<string, any>;

/** Running totals, so a test can tell "never called" from "called once". */
export interface Counts {
    runs: number;
    firstTick: number | null;
    lastError: string;
}

export interface Bridge {
    status(): unknown;
    playerCell(): unknown;
    worldSize(): unknown;
    dump(path: string): unknown;
    newWorld(): unknown;
    at(x: number, y: number): unknown;
    column(x: number, from: number, count: number): [number, unknown][];
    /** Coarse map of which columns hold anything — finds terrain fast. */
    contentColumns(width: number, step: number): [number, number][];
    register(id: string, shape?: number[][]): unknown;
    place(id: string, x: number, y: number): unknown;
    attachProcess(typeId: string, body: string, intervalMs?: number): unknown;
    counts: Counts;
    /** Remove the global. The disable path calls this. */
    uninstall(): void;
}

/**
 * Build the command object.
 *
 * A factory rather than a module-level singleton so `main.ts` can create and
 * drop it symmetrically on enable/disable, and so a test can build its own.
 */
export function createBridge(): Bridge {
    const counts: Counts = { runs: 0, firstTick: null, lastError: "" };
    const getTick = (): number => api?.time?.getTick?.() ?? -1;

    const bridge: Bridge = {
        /** Scene, tick and where the player is. First call after any change. */
        status() {
            return {
                scene: api?.scene?.getActive?.(),
                tick: getTick(),
                world: store?.meta?.worldName,
                worldSize: store?.world?.size ?? null,
                playerCell: bridge.playerCell(),
            };
        },

        /**
         * Player position in **cells**.
         *
         * `store.player.x/y` are pixels and `cellSize` is 4 in a real save, so
         * the division is mandatory — skipping it puts every placement
         * thousands of cells out of range, where it silently never commits.
         */
        playerCell() {
            const pl = store?.player;
            const cellSize = api?.rendering?.getGridMetrics?.()?.cellSize ?? 24;
            if (typeof pl?.x !== "number") return null;
            return {
                px: pl.x,
                py: pl.y,
                cellSize,
                x: Math.floor(pl.x / cellSize),
                y: Math.floor(pl.y / cellSize),
            };
        },

        worldSize() {
            return store?.world?.size ?? null;
        },

        /**
         * Read any dotted path under `sandkit.state`. The pause and saving flags
         * live here and are on no public API — this is the only way to see them.
         */
        dump(path: string) {
            let node: unknown = sandkit.state;
            for (const key of path.split(".")) {
                if (node == null) return { path, missing: true };
                node = (node as Record<string, unknown>)[key];
            }
            return { path, value: node ?? null };
        },

        /**
         * `api.game.start({})`. Only creates a world from the main menu — once a
         * world is active it is a silent no-op, so this is **not** a way to get
         * a fresh world mid-session.
         */
        newWorld() {
            try {
                api?.game?.start?.({});
                return { ok: true };
            } catch (e) {
                return { ok: false, threw: (e as Error).message };
            }
        },

        at(x: number, y: number) {
            return {
                element: api?.elements?.getTypeAtCell?.(x, y) ?? null,
                structure: api?.structures?.getAtCell?.(x, y) ?? null,
            };
        },

        /** Rows in `[from, from + count)` that hold an element. */
        column(x: number, from: number, count: number) {
            const hits: [number, unknown][] = [];
            for (let y = from; y < from + count; y++) {
                const t = api?.elements?.getTypeAtCell?.(x, y);
                if (t != null) hits.push([y, t]);
            }
            return hits;
        },

        /**
         * How many elements each sampled column holds. A loaded save is mostly
         * empty, and this is the fastest way to find the part that is not.
         */
        contentColumns(width: number, step: number) {
            const out: [number, number][] = [];
            for (let x = 0; x < width; x += step) {
                const n = bridge.column(x, 0, width).length;
                if (n > 0) out.push([x, n]);
            }
            return out;
        },

        register(id: string, shape?: number[][]) {
            try {
                api?.structures?.register?.({
                    id,
                    name: id,
                    categoryKey: "special",
                    shape: shape ?? [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
                    alwaysUnlocked: true,
                });
                return { ok: true, id };
            } catch (e) {
                return { ok: false, threw: (e as Error).message };
            }
        },

        /**
         * Place, then report what the engine **actually** did.
         *
         * A record carrying `queued: true` means the placement was accepted but
         * has not committed. Reading `getAtCell` immediately after `buildAtCell`
         * is the mistake that makes a pending placement look like a failure —
         * and, in a world that never settles them, a permanent one.
         */
        place(id: string, x: number, y: number) {
            try {
                api?.structures?.buildAtCell?.(x, y, id);
            } catch (e) {
                return { at: [x, y], threw: (e as Error).message };
            }
            const record = api?.structures?.getAtCell?.(x, y) ?? null;
            return {
                at: [x, y],
                committed: record != null && record.queued !== true,
                queued: record?.queued === true,
                record,
            };
        },

        /**
         * Attach a processor to a structure type. `body` is a function **body**
         * string; the engine invokes it as `(structure, context)`.
         *
         * Both arguments come from the engine, so a body written at the terminal
         * can act on the world without needing `sandkit` itself:
         *
         *     __sk.attachProcess("probe",
         *         "s.data.runs = (s.data.runs || 0) + 1;", 100)
         *
         * `new Function` is used rather than `eval` — see the header note.
         */
        attachProcess(typeId: string, body: string, intervalMs = 100) {
            const processing = api?.structures?.processing;
            if (typeof processing?.register !== "function") {
                return { ok: false, why: "structures.processing.register missing" };
            }
            let fn: (structure: unknown, context: unknown) => void;
            try {
                fn = new Function("s", "c", body) as typeof fn;
            } catch (e) {
                return { ok: false, why: `bad body: ${(e as Error).message}` };
            }
            try {
                processing.register(`${typeId}#process`, {
                    structureType: typeId,
                    intervalMs,
                    process: (structure: unknown, context: unknown) => {
                        counts.runs++;
                        if (counts.firstTick == null) counts.firstTick = getTick();
                        try {
                            fn(structure, context);
                        } catch (e) {
                            counts.lastError = (e as Error).message;
                        }
                    },
                });
                return { ok: true, typeId, intervalMs };
            } catch (e) {
                return { ok: false, threw: (e as Error).message };
            }
        },

        counts,

        uninstall() {
            delete (globalThis as Record<string, unknown>).__sk;
        },
    };

    return bridge;
}
