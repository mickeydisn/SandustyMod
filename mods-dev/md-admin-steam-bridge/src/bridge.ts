/** What the engine's batch writer had, once `mutate` has handed one over. */
let writerKeys: string[] | null = null;

/** What a deferred `mutate` batch saw, read on a later tick. */
let deferredRead: unknown = null;

/** The same for the read-before-batch order. */
let deferredSafe: unknown = null;
let safeRead: unknown = null;

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
    /** Queue for the next idle frame — `buildAtCell` often never settles. */
    placeWhenIdle(id: string, x: number, y: number): unknown;
    attachProcess(typeId: string, body: string, intervalMs?: number): unknown;
    counts: Counts;
    /** Read another mod's persisted storage — how a config gets loaded headlessly. */
    storageGet(modId: string, key: string): unknown;
    /** Write another mod's storage. `json` is a string; it is parsed here. */
    storageSet(modId: string, key: string, json: string): unknown;
    /** Every structure type, as a sorted array (built-ins are numbers). */
    structureTypes(): unknown;
    /** Just the structure types whose id contains `filter`. */
    structureTypesMatching(filter: string): unknown;
    /** Request an exit-save. A `pkill` does not, and the write is lost. */
    save(saveId: string, saveName?: string): unknown;
    /** The save flag as the engine currently sees it. */
    saveState(): unknown;
    /** Read a shared JsonMapBuffer by key (one arg — there is no mod id). */
    bufferGet(key: string): unknown;
    /** Write a shared buffer value — a sentinel proves a processor is running. */
    bufferSet(key: string, path: string, value: number): unknown;
    /** Whether the engine actually holds a graphics key (`getById`). */
    hasSprite(id: string): unknown;
    /** Probe several keys in one round trip. */
    hasSprites(ids: string[]): unknown;
    /** The definition the engine holds for a structure type. */
    structureDef(id: string): unknown;
    /** Remove whatever is at a cell; reports what was there. */
    removeAt(x: number, y: number): unknown;
    /** Remove every `queued: true` structure — a stuck one poisons its tile. */
    removeStuck(): unknown;
    /** The methods the engine's `grid.mutate` writer really has. */
    writerShape(): unknown;
    /**
     * Run one `grid.mutate` batch with a **real** engine context, to reproduce a
     * crash that only happens in the game.
     */
    tryWriterRemove(ctx: unknown, x: number, y: number, want: string): unknown;
    /** What the last deferred `mutate` batch saw, read on a later tick. */
    deferredRead(): unknown;
    /**
     * The same batch reading the context **before** opening it — the order
     * `writeCells` now uses, proven against the live engine.
     */
    safeWriterRemove(ctx: unknown, x: number, y: number, want: string): unknown;
    /** What the deferred *safe* batch did. */
    deferredSafe(): unknown;
    /** What the synchronous read saw, before the batch opened. */
    safeRead(): unknown;
    /** Place an element at a cell, for feeding a machine. */
    putElement(id: string, x: number, y: number): unknown;
    /** Structures with a `queued: true` flag, for patching a save. */
    structureFlags(): unknown;
    /** Describe the engine's processing registry. */
    processingApi(): unknown;
    /** Drop a structure type's registered processing, for a control probe. */
    unprocess(typeId: string): unknown;
    /** Read/flip the per-cell processing enable gate. */
    processEnabled(x: number, y: number, enable?: boolean): unknown;
    /** Drop the player onto the terrain under them. */
    teleportToGround(): unknown;
    /** Remove the element at a cell via the WhenIdle variant. */
    takeElement(x: number, y: number): unknown;
    /** Enumerate the instances the engine holds for a structure type. */
    instancesOfType(typeId: string): unknown;
    /** Everything the engine knows about one cell. */
    cellInfo(x: number, y: number): unknown;
    /** The engine's authoritative world dimensions. */
    dimensions(): unknown;
    /** List the members of an `api` namespace. */
    apiKeys(ns: string): unknown;
    /** All element ids the engine knows, with their numeric types. */
    resolveElements(ids: string[]): unknown;
    /** The engine's element catalogue as id -> numeric type. */
    elementCatalog(limit?: number): unknown;
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

        /**
         * Read another mod's storage.
         *
         * `api.storage` is namespaced by mod id, and it is the only way into a
         * mod's persisted state — a mod's config panel writes there, so this is
         * how a config authored elsewhere gets loaded without clicking the UI.
         */
        storageGet(modId: string, key: string) {
            try {
                const value = api?.storage?.get?.(modId, key);
                return { modId, key, value: value ?? null, present: value !== undefined };
            } catch (e) {
                return { modId, key, threw: (e as Error).message };
            }
        },

        /**
         * Write another mod's storage. `value` arrives as a **JSON string**,
         * because a CDP expression can only pass strings across the boundary and
         * the whole config is large.
         *
         * Returns nothing useful on success — the caller re-reads with
         * `storageGet`, because a write that appears to work but did not land is
         * exactly the failure this whole flow is watching for.
         */
        storageSet(modId: string, key: string, json: string) {
            try {
                api?.storage?.ensure?.(modId);
                const value = JSON.parse(json);
                api?.storage?.set?.(modId, key, value);
                return { ok: true, modId, key, bytes: json.length };
            } catch (e) {
                return { ok: false, modId, key, threw: (e as Error).message };
            }
        },

        /**
         * Every structure type the engine currently knows about.
         *
         * `getAvailableTypes()` is a `Set`, which does not survive
         * `JSON.stringify` — a Set stringifies to `{}`. Spreading it here is what
         * makes the answer readable from the terminal at all.
         */
        structureTypes() {
            try {
                const set = api?.structures?.getAvailableTypes?.();
                return { count: set?.size ?? 0, ids: [...(set ?? [])].sort() };
            } catch (e) {
                return { threw: (e as Error).message };
            }
        },

        /**
         * Just the types whose id carries `filter` — for "did my mod land?".
         *
         * `String(id)` first: a mod registers string ids, but the engine's own
         * built-in types come back as bare **numbers** (`11`, `12`, …), and
         * `id.includes(...)` on a number is a TypeError that kills the call. The
         * full 715-type list is mostly those numbers, so this is not an edge case.
         */
        structureTypesMatching(filter: string) {
            const all = bridge.structureTypes() as { ids?: unknown[] };
            return {
                ids: (all.ids ?? [])
                    .map((id) => String(id))
                    .filter((id) => id.includes(filter))
                    .sort(),
            };
        },

        /**
         * Ask the engine to write an exit-save.
         *
         * `pkill` and even a graceful AppleScript quit both **lose** everything
         * written through `storageSet`: the renderer is gone before the save
         * runs, so the file never changes. Confirmed by mtime, not assumed.
         *
         * The engine's save is gated on a very specific shape, found in
         * `dist/js/bundle.js`:
         *
         *     M = e => { if (!e.session.saving) return;
         *                if ("pending" !== e.session.saving.status) return; … }
         *
         * so the flag has to be `{ id, name, type, status: "pending" }` with
         * `type` one of `autosave` / `quicksave` / `exitsave`. Anything else is
         * silently ignored — a save that appears to have been requested and
         * writes nothing.
         *
         * The path is `state.session`, **not** `state.store.session`. `e.store`
         * is the persistent payload; `e.session` is the live session beside it.
         * Writing the flag into `store` puts it somewhere the engine never
         * looks, and it just sits there at `"pending"` forever.
         */
        save(saveId: string, saveName = "world") {
            try {
                const state = (sandkit as { state?: any }).state;
                if (!state) return { ok: false, why: "no state" };
                state.session ??= {};
                state.session.saving = {
                    name: saveName,
                    id: saveId,
                    type: "exitsave",
                    status: "pending",
                };
                return { ok: true, requested: state.session.saving };
            } catch (e) {
                return { ok: false, threw: (e as Error).message };
            }
        },

        /** The save flag as the engine currently sees it. */
        saveState() {
            const state = (sandkit as { state?: any }).state;
            return { saving: state?.session?.saving ?? null };
        },

        /**
         * Read/write a mod's shared `JsonMapBuffer`.
         *
         * This is the other half of `api.storage` — the cross-thread buffers a
         * mod's processors read through `bufferRead`/`bufferIncrement`. It exists
         * here to answer one specific question that storage cannot: does a
         * processor actually *run*?
         *
         * The trick is a sentinel. A tick that mirrors `progress` into the
         * structure's data is invisible if the buffer already holds the same
         * number, so writing a value nothing would coincidentally hold makes the
         * whole chain observable — buffer → compiled process → setStructureData →
         * live structure.
         */
        /**
         * Read a mod's shared `JsonMapBuffer` by key.
         *
         * `api.shared.buffers.get` takes **one** argument — the key. There is no
         * mod id: a mod's own buffers are namespaced by its runtime, so passing
         * a second argument silently looks up an unrelated key and reports
         * "absent" for a buffer that exists.
         */
        bufferGet(key: string) {
            try {
                const b = api?.shared?.buffers?.get?.(key);
                return { key, present: !!b, all: b ? b.all?.() ?? null : null };
            } catch (e) {
                return { key, threw: (e as Error).message };
            }
        },

        bufferSet(key: string, path: string, value: number) {
            try {
                const b = api?.shared?.buffers?.get?.(key);
                if (!b) return { ok: false, why: `no buffer "${key}"` };
                b.set(path, value);
                return { ok: true, path, value, readBack: b.get(path) };
            } catch (e) {
                return { ok: false, threw: (e as Error).message };
            }
        },

        /**
         * Queue a placement for the next idle frame.
         *
         * `buildAtCell` is a **main-thread write that is deferred**, and in a
         * world loaded via `?db_load=` it frequently never settles — the call
         * returns, nothing appears, and `getAtCell` stays null. `…WhenIdle` is
         * the engine's own answer to that, and is the one that works here.
         *
         * Still a queue, not a commit: the caller re-reads with `at()`.
         */
        placeWhenIdle(id: string, x: number, y: number) {
            try {
                api?.structures?.buildAtCellWhenIdle?.(x, y, id);
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
         * Whether the engine actually holds a graphics key.
         *
         * `api.sprites.list` / `getAll` are **not** that — there is no `list`, and
         * probing for one returns nothing at all, for any mod, which reads
         * exactly like "no sprites loaded anywhere". The real accessor is
         * `getById`, so that is what this asks.
         *
         * The distinction matters: "the path is in my config" and "the texture
         * decoded in the engine" are different claims and only this is evidence.
         */
        hasSprite(id: string) {
            try {
                const s = api?.sprites?.getById?.(id);
                return { id, loaded: !!s, detail: s ? Object.keys(s) : null };
            } catch (e) {
                return { id, threw: (e as Error).message };
            }
        },

        /** Probe several keys at once, so one round trip covers the whole set. */
        hasSprites(ids: string[]) {
            return ids.map((id) => bridge.hasSprite(id) as { id: string; loaded: boolean });
        },

        /**
         * The definition the engine actually holds, for a structure type.
         *
         * This is the difference between "the config says X" and "the engine
         * received X". Two of this config's bugs were invisible from the file:
         * `spritesheet` nested inside `render` rather than beside it, and a
         * missing `tooltipHover` — both read fine on disk and never reached the
         * engine. Only the registered definition can tell.
         */
        structureDef(id: string) {
            try {
                const d = api?.structures?.getDefinitionByType?.(id);
                if (!d) return null;
                // Trim to what is worth reading back over CDP.
                return {
                    id: d.id,
                    hasTopLevelSpritesheet: d.spritesheet ?? null,
                    hasNestedSpritesheet: d.render?.spritesheet ?? null,
                    tooltipType: d.tooltipHover?.type ?? null,
                    tooltipMessage: d.tooltipHover?.dataFieldMessage?.message
                        ? String(d.tooltipHover.dataFieldMessage.message).slice(0, 60)
                        : null,
                    renderImage: d.render?.imageName ?? null,
                    defaultDataKeys: Object.keys(d.defaultData ?? {}),
                };
            } catch (e) {
                return { threw: (e as Error).message };
            }
        },

        /**
         * Remove whatever is at a cell, and report what was there.
         *
         * Needed because a placement can get permanently stuck. The engine marks a
         * structure `queued: true` when the tile under it is already in
         * `TILE_MODE_QUEUED`, and the resolve pass only clears the flag once the
         * tile *leaves* that mode. A stuck one therefore poisons the tile, and
         * every later placement on that cell is queued again — and if the world
         * is saved in that state, the poison comes back on the next load.
         *
         * Reads before and writes, because "remove requested" and "removed" are
         * different: removal is deferred, and reporting success from the call
         * alone would repeat the mistake `place` documents.
         */
        removeAt(x: number, y: number) {
            const before = api?.structures?.getAtCell?.(x, y) ?? null;
            try {
                api?.structures?.removeAtCell?.(x, y);
            } catch (e) {
                return { at: [x, y], was: before?.type ?? null, threw: (e as Error).message };
            }
            const after = api?.structures?.getAtCell?.(x, y) ?? null;
            return {
                at: [x, y],
                was: before?.type ?? null,
                wasQueued: before?.queued === true,
                removed: after == null,
                stillThere: after?.type ?? null,
            };
        },

        /** Remove every structure with `queued: true`, wherever it is. */
        removeStuck() {
            const store = (sandkit as { state?: { store?: any } }).state?.store;
            const list = store?.structures;
            if (!Array.isArray(list)) return { removed: 0, why: "structures not an array" };
            const stuck = list.filter((s: { queued?: boolean }) => s?.queued === true);
            for (const s of stuck) {
                try {
                    api?.structures?.removeAtCell?.(s.x, s.y);
                } catch { /* reported below by the count */ }
            }
            return {
                removed: stuck.length,
                at: stuck.map((s: { type: string; x: number; y: number }) =>
                    `${s.type}@${s.x},${s.y}`
                ),
            };
        },

        /**
         * Place an element at a cell, for feeding a machine.
         *
         * `createAtCell` is a main-thread write like `buildAtCell`, so it may not
         * settle in a `?db_load=` world either — the caller re-reads with `at()`.
         */

        /**
         * The methods the engine's batch writer actually has.
         *
         * Asked because `GridMutationWriterElements` is documented with
         * `createAtCell` and `replaceAtCell` and the mod had believed a third,
         * `removeAtCell`, that existed — taking it from its own interface rather
         * than from `grid.d.ts`. Every test agreed with the mod, so nothing caught
         * it until a processor actually ran. This reads the real thing.
         */
        writerShape() {
            const grid = api?.grid as
                | { mutate?: (fn: (w: { elements: object }) => void) => void }
                | undefined;
            if (!grid || typeof grid.mutate !== "function") {
                return { error: "api.grid.mutate is missing", hasGrid: !!grid };
            }
            // `mutate` **defers** its callback — the first call reported
            // `called: false`, so a synchronous read answers "the writer has no
            // methods" for a writer that simply had not been handed over yet.
            // Open a batch on the first call and read what arrived on the next.
            if (writerKeys === null) {
                writerKeys = [];
                try {
                    grid.mutate((w: { elements: object }) => {
                        writerKeys = Object.keys(w.elements as Record<string, unknown>);
                    });
                } catch (e) {
                    writerKeys = null;
                    return { threw: (e as Error).message };
                }
                return { pending: true };
            }
            return { keys: writerKeys };
        },

        /**
         * Run one `grid.mutate` batch against a **real** engine context, and report
         * what the writer turned out to have.
         *
         * This exists to reproduce a crash that only happens in the game: the
         * `writeCells` path in md-my-hown-mod reads `ctx.getResolvedTypeAtCell` /
         * `ctx.isCellEmptyAtCell` and calls `writer.elements.*` inside the batch,
         * and a fake host cannot tell us what the engine's real context does there.
         * The writer was also found to have `removeAtCell` at runtime despite
         * `grid.d.ts` declaring only two methods — so the typings are not a
         * substitute for asking.
         */
        tryWriterRemove(ctx: unknown, x: number, y: number, want: string) {
            const c = ctx as {
                getResolvedTypeAtCell?: (a: number, b: number) => unknown;
                isCellEmptyAtCell?: (a: number, b: number) => boolean;
            };
            let writerKeys: string[] | null = null;
            let current: unknown = undefined;
            let empty: boolean | undefined;
            let threw: string | null = null;
            // Read the context **inside** the batch, as `writeCells` does, and keep
            // the answer in a module variable so it survives the deferral. A local
            // here would always read as pending.
            deferredRead = null;
            try {
                api?.grid?.mutate?.((w: { elements: Record<string, unknown> }) => {
                    try {
                        writerKeys = Object.keys(w.elements);
                        empty = c.isCellEmptyAtCell?.(x, y);
                        current = empty ? null : c.getResolvedTypeAtCell?.(x, y);
                        const fn = w.elements.removeAtCell as
                            | ((a: number, b: number) => void)
                            | undefined;
                        if (typeof fn !== "function") {
                            threw = "writer.elements.removeAtCell is not a function";
                            return;
                        }
                        if (String(current) === want) fn(x, y);
                        deferredRead = { writerKeys, current, empty, threw: null };
                    } catch (e) {
                        threw = (e as Error).message;
                        deferredRead = { writerKeys, current, empty, threw };
                    }
                });
            } catch (e) {
                threw = (e as Error).message;
            }
            return { threw, writerKeys, current, empty, want, deferred: deferredRead };
        },

        /** What the last deferred batch saw — read on a later tick. */
        deferredRead(): unknown {
            return deferredRead;
        },

        /**
         * The same batch, but reading the context **before** opening it — the
         * order `writeCells` now uses.
         *
         * `tryWriterRemove` reads inside the batch and throws
         * `Structure processor context can only be used during process()`; this one
         * is the proof that reading first is enough, against the same live engine
         * and the same live context. The two together are the whole bug report.
         */
        safeWriterRemove(ctx: unknown, x: number, y: number, want: string) {
            const c = ctx as {
                getResolvedTypeAtCell?: (a: number, b: number) => unknown;
                isCellEmptyAtCell?: (a: number, b: number) => boolean;
            };
            // Synchronous, while `process()` is still on the stack.
            const empty = c.isCellEmptyAtCell?.(x, y);
            const current = empty ? null : c.getResolvedTypeAtCell?.(x, y);
            safeRead = { empty, current };
            deferredSafe = null;
            api?.grid?.mutate?.((w: { elements: Record<string, unknown> }) => {
                deferredSafe = { writerKeys: Object.keys(w.elements) };
                if (String(current) !== want) return;
                const fn = w.elements.removeAtCell as
                    | ((a: number, b: number) => void)
                    | undefined;
                if (typeof fn === "function") fn(x, y);
            });
            return { safeRead, deferredSafe };
        },

        /** What the deferred *safe* batch did, read on a later tick. */
        deferredSafe(): unknown {
            return deferredSafe;
        },

        /** What the synchronous read saw, before the batch opened. */
        safeRead(): unknown {
            return safeRead;
        },

        /**
         * Place an element at a cell, for feeding a machine.
         *
         * There is no `api.elements.createAtCell`. The only writer that creates
         * elements is the one handed to `grid.mutate`, and it throws
         * "The world writer can only be used inside grid.mutate()" otherwise — so
         * a direct call is not merely wrong, it cannot work. `grid.mutate` is
         * deferred, so the write lands after this returns: re-read with `at()`.
         */
        putElement(id: string, x: number, y: number) {
            // Two API mistakes hid here for a long time. The resolver is
            // `getTypeFromId`, not `getElementTypeFromId` (which does not exist and
            // so quietly returned undefined). And `createAtCell` takes FOUR
            // arguments — calling it with three does nothing at all, no throw.
            const type = api?.elements?.getTypeFromId?.(id);
            if (type == null) return { at: [x, y], id, error: "unresolved id" };
            const before = api?.elements?.getTypeAtCell?.(x, y) ?? null;
            try {
                // Three separate lessons, all learned the hard way here:
                //  - `createAtCell` only fills an *empty* cell, and the surface
                //    already carries elements, while `replaceAtCell` refuses to
                //    overwrite an existing element — it only swaps terrain. So
                //    clear first.
                //  - the direct calls do not take effect at all. Only the
                //    `…WhenIdle` variants settle — the same reason
                //    `buildAtCell` needed `buildAtCellWhenIdle` for structures.
                if (before != null) api?.elements?.removeAtCellWhenIdle?.(x, y, {});
                // `replaceAtCell` is the one that works on a cell holding terrain,
                // `createAtCell` the one that works on a cell that is empty. Which
                // applies is not knowable from here, so submit both — they target
                // the same element type, and whichever the engine accepts wins.
                api?.elements?.replaceAtCellWhenIdle?.(x, y, type, {});
                api?.elements?.createAtCellWhenIdle?.(x, y, type, {});
            } catch (e) {
                return { at: [x, y], id, type, threw: (e as Error).message };
            }
            return {
                at: [x, y],
                id,
                type,
                before,
                immediate: api?.elements?.getTypeAtCell?.(x, y) ?? null,
                resolved: api?.elements?.getResolvedTypeAtCell?.(x, y) ?? null,
                cellId: api?.grid?.getCellIdAtCell?.(x, y) ?? null,
            };
        },

        /**
         * Every structure in the world with its `queued` flag, for patching a save.
         *
         * `queued: true` is the wall in a `?db_load=` world: a placement is marked
         * queued when the tile under it is already `TILE_MODE_QUEUED`, and the
         * resolve pass only clears it once the tile leaves that mode — which
         * nothing does. The instance exists, renders, and is never processed.
         */
        structureFlags() {
            const list = (sandkit as { state?: { store?: { structures?: unknown[] } } }).state
                ?.store?.structures;
            if (!Array.isArray(list)) return { error: "structures not an array" };
            const all = list as { queued?: boolean; type: string; x: number; y: number }[];
            return {
                total: all.length,
                queued: all
                    .filter((s) => s?.queued === true)
                    .map((s) => `${s.type}@${s.x},${s.y}`),
            };
        },

        /**
         * Describe the processing registry so a scheduled-vs-unscheduled
         * difference can be pinned down instead of guessed at.
         *
         * `api` is a module-local in the game bundle, so there is no way to reach
         * it from the page; this is the one door onto it.
         */
        processingApi() {
            const p = api?.structures?.processing;
            if (!p) return { missing: true };
            const out: Record<string, unknown> = { own: Object.keys(p) };
            for (const k of Object.keys(p)) {
                const v = (p as Record<string, unknown>)[k];
                if (typeof v === "function") {
                    out[k] = `fn/${v.length}`;
                } else if (v && typeof v === "object") {
                    // The registry itself: which structureType -> entry ids the
                    // engine believes it can schedule.
                    out[k] = Object.keys(v as object).slice(0, 40);
                } else {
                    out[k] = v;
                }
            }
            return out;
        },

        /**
         * Drop a structure type's registered processing, so a control probe can
         * be attached to the same instances. Test-harness only.
         */
        /**
         * List the members of an `api` namespace, so a route that does not exist
         * can be told apart from one that is being called wrongly. Optional
         * chaining over a missing method returns quietly, which is exactly how
         * `api.elements.createAtCell` looked like a working call for hours.
         */
        apiKeys(ns: string) {
            const target = ns.split(".").reduce<any>((acc, k) => acc?.[k], api);
            if (!target) return { ns, missing: true };
            const out: Record<string, unknown> = {};
            for (const k of Object.keys(target)) {
                const v = target[k];
                out[k] = typeof v === "function"
                    ? `fn/${(v as Function).length}`
                    : (v && typeof v === "object" ? `obj[${Object.keys(v).length}]` : v);
            }
            return { ns, members: out };
        },

        /**
         * Everything the engine knows about one cell.
         *
         * `cellId: 0` is the tell that a cell is not part of the simulated world
         * at all — writes to it are accepted and then never appear, and reads stay
         * null. That is what made the player look like a broken world.
         */
        /**
         * Remove whatever element sits at a cell, reporting which variant ran.
         *
         * `api.elements.removeAtCell` returns without doing anything — verified in
         * the live engine, the element is still there a moment later. Only the
         * `…WhenIdle` variant lands.
         */
        takeElement(x: number, y: number) {
            const before = api?.elements?.getTypeAtCell?.(x, y) ?? null;
            const api_ = api?.elements as Record<string, unknown> | undefined;
            const hasIdle = typeof api_?.removeAtCellWhenIdle === "function";
            const hasPlain = typeof api_?.removeAtCell === "function";
            try {
                (api_?.removeAtCellWhenIdle as
                    | ((a: number, b: number, o: unknown) => void)
                    | undefined)?.(x, y, {});
            } catch (e) {
                return { at: [x, y], before, threw: (e as Error).message, hasIdle, hasPlain };
            }
            return { at: [x, y], before, hasIdle, hasPlain };
        },

        /**
         * Enumerate the instances the engine itself holds for a structure type.
         *
         * `store.structures` and `getAtCell` can both show a structure while the
         * periodic that should be running it never sees it — the flush compares the
         * two by **object identity**, so "it is in the store" and "the engine holds
         * that exact object" are different claims. This is the second one.
         */
        instancesOfType(typeId: string) {
            const out: { x: number; y: number; queued?: boolean }[] = [];
            try {
                api?.structures?.forEachOfType?.(
                    (s: { x: number; y: number; queued?: boolean }) => {
                        out.push({ x: s.x, y: s.y, queued: s.queued });
                    },
                    typeId,
                );
            } catch (e) {
                return { typeId, threw: (e as Error).message };
            }
            return { typeId, count: out.length, at: out.slice(0, 8) };
        },

        /**
         * Drop the player onto the terrain under them.
         *
         * A fresh world starts the player high in the sky, well above the ground
         * (player y 589 against a horizon near 1440). Chunks around the ground are
         * not loaded, so structures there never materialise and element writes land
         * in unallocated space — cellId 0. This closes that gap.
         */
        teleportToGround() {
            try {
                api?.player?.teleportToGround?.();
            } catch (e) {
                return { threw: (e as Error).message };
            }
            return {
                playerCell: bridge.playerCell(),
                onGround: api?.player?.isOnGround?.(),
            };
        },

        cellInfo(x: number, y: number) {
            return {
                at: [x, y],
                cellId: api?.grid?.getCellIdAtCell?.(x, y) ?? null,
                empty: api?.grid?.isCellEmptyAtCell?.(x, y) ?? null,
                terrain: api?.grid?.isTerrainAtCell?.(x, y) ?? null,
                element: api?.elements?.getTypeAtCell?.(x, y) ?? null,
            };
        },

        /** The engine's authoritative world dimensions. */
        dimensions() {
            return { grid: api?.grid?.getDimensions?.() ?? null };
        },

        /** Resolve several element ids at once, so a wrong id is obvious. */
        resolveElements(ids: string[]) {
            const out: Record<string, unknown> = {};
            for (const id of ids) {
                try {
                    out[id] = api?.elements?.getTypeFromId?.(id) ?? "unresolved";
                } catch (e) {
                    out[id] = `throws: ${(e as Error).message}`;
                }
            }
            return out;
        },

        /**
         * The engine's own element catalogue, as id -> numeric type.
         *
         * Guessing ids does not work: `getTypeFromId` *throws* on an unknown one
         * rather than returning undefined, and "gold" is not the id Sandustry
         * uses for gold.
         */
        elementCatalog(limit = 400) {
            const types = api?.elements?.getRegisteredTypes?.() ?? [];
            const out: Record<string, unknown> = {};
            for (const t of (types as number[]).slice(0, limit)) {
                try {
                    const id = api?.elements?.getIdByType?.(t);
                    if (id) out[id] = t;
                } catch {
                    /* an unregistered type throws; that is not interesting */
                }
            }
            return { count: out.length, ids: out };
        },

        unprocess(typeId: string) {
            const p = api?.structures?.processing as Record<string, any>;
            for (const fn of ["unregister", "remove", "delete"]) {
                if (typeof p?.[fn] === "function") {
                    try {
                        p[fn](typeId);
                        return { ok: true, via: fn };
                    } catch (e) {
                        return { ok: false, via: fn, threw: (e as Error).message };
                    }
                }
            }
            return { ok: false, why: "no unregister/remove/delete on processing" };
        },

        /**
         * Read and flip the per-cell processing enable gate.
         *
         * `structures.processing` exposes `isEnabledAtCell`/`setEnabledAtCell`
         * alongside `register`. Registering an entry is therefore **not** enough to
         * make it run: the gate is a separate per-cell switch, and a structure
         * placed without going through the game's own build path is left disabled.
         */
        processEnabled(x: number, y: number, enable?: boolean) {
            const p = api?.structures?.processing as Record<string, any>;
            const is = () => p?.isEnabledAtCell?.(x, y);
            const before = (() => {
                try {
                    return is();
                } catch (e) {
                    return `threw: ${(e as Error).message}`;
                }
            })();
            if (enable === undefined) return { at: [x, y], enabled: before };
            try {
                p?.setEnabledAtCell?.(x, y, enable);
            } catch (e) {
                return { at: [x, y], before, threw: (e as Error).message };
            }
            return {
                at: [x, y],
                before,
                after: (() => {
                    try {
                        return is();
                    } catch {
                        return "?";
                    }
                })(),
            };
        },

        uninstall() {
            delete (globalThis as Record<string, unknown>).__sk;
        },
    };

    return bridge;
}
