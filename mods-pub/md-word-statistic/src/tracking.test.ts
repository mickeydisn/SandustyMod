/**
 * The Tracking Configuration numbers must actually persist.
 *
 * Regression, and the reason this mod looked broken: `api.settings` is
 * **read-only** — the engine gives a mod `get`, `getAll` and `onChange`, and no
 * `set`. The old `setSetting` called `api.settings.set?.(key, value)`, which was
 * a silent no-op, and `getConfig()` then re-read the engine bag and handed back
 * the old number. The steppers for "Max data points" and "Display points" looked
 * frozen, and the mod never even got an `externalModSettings` entry.
 *
 * The stub below deliberately exposes **no `settings.set`**, exactly like the
 * engine. If anything ever routes these numbers back through `api.settings`, the
 * persistence tests here start failing instead of shipping the same bug again.
 */
// @ts-nocheck: the stub is a partial `sandkit` global with deliberately loose
// shapes; type-checking it would assert against APIs this file never touches.
import { assertEquals } from "jsr:@std/assert@1";

const MOD = "md-word-statistic";
const storage = new Map();
/** The engine's own settings bag — read-only, exactly as the host exposes it. */
let engineBag: Record<string, unknown> = {};

globalThis.sandkit = {
    api: {
        storage: {
            get: (mod: string, k: string) => storage.get(`${mod}::${k}`),
            set: (mod: string, k: string, v: unknown) => void storage.set(`${mod}::${k}`, v),
            remove: (mod: string, k: string) => void storage.delete(`${mod}::${k}`),
        },
        settings: {
            get: (n: string) => engineBag[n],
            getAll: () => ({ ...engineBag }),
            // NOTE: no `set`. See the file header.
            onChange: () => {},
        },
    },
    ui: { toast: () => {} },
    events: { on: () => {} },
};

// `@sandmd/ui` reads `sandkit` at module load, so it is imported dynamically.
const { createTrackingStore, TRACKING_FIELDS, TRACKING_SECTION } = await import("@sandmd/ui");
// `constants.ts` only mirrors modinfo.json, so it is safe to pull in here.
const { SETTINGS } = await import("./constants.ts");

/** A fresh store, so the in-memory cache never leaks between tests. */
const freshStore = () =>
    createTrackingStore(MOD, "tracking", { timeRange: "autoRefreshMinutes" });

const DEFAULTS = { timeRange: 2, maxCountSave: 120, historyMax: 30 };

/**
 * Start from a clean slate.
 *
 * Every test needs this: the store caches and `storage` is module-level, so a
 * value written by one test would otherwise satisfy the next test's read for the
 * wrong reason — which is exactly the bug these tests exist to catch.
 */
const reset = () => {
    storage.clear();
    engineBag = {};
};

Deno.test("a written value lands in mod storage and comes back after a reload", () => {
    reset();
    // The bug: this write used to go to a non-existent api.settings.set and was
    // lost, so a new store — i.e. the next launch — read the default back.
    freshStore().write("historyMax", 60);

    assertEquals(
        storage.get(`${MOD}::tracking`),
        { ...DEFAULTS, historyMax: 60 },
        "historyMax never reached storage",
    );
    assertEquals(freshStore().read().historyMax, 60, "the new value did not survive");
});

Deno.test("all three settings persist independently", () => {
    reset();
    const store = freshStore();
    store.write("timeRange", 7);
    store.write("maxCountSave", 500);
    store.write("historyMax", 45);

    // One key holds all three; a single save must not clobber its siblings.
    assertEquals(storage.get(`${MOD}::tracking`), {
        timeRange: 7,
        maxCountSave: 500,
        historyMax: 45,
    });
    assertEquals(freshStore().read(), { timeRange: 7, maxCountSave: 500, historyMax: 45 });
});

Deno.test("a write is reflected immediately, not only on the next read", () => {
    reset();
    const store = freshStore();
    assertEquals(store.read().historyMax, 30);
    store.write("historyMax", 99);
    assertEquals(store.read().historyMax, 99, "the cached bag went stale");
});

Deno.test("values are clamped to the schema range", () => {
    reset();
    const store = freshStore();
    assertEquals(store.write("historyMax", 9999).historyMax, TRACKING_FIELDS.historyMax.max);
    assertEquals(store.write("historyMax", -5).historyMax, TRACKING_FIELDS.historyMax.min);
    assertEquals(store.write("maxCountSave", 3).maxCountSave, TRACKING_FIELDS.maxCountSave.min);
    assertEquals(store.write("timeRange", 0).timeRange, TRACKING_FIELDS.timeRange.min);
});

Deno.test("an engine setting seeds the first read, then storage wins", () => {
    reset();
    // A value set in the game's own mod-settings screen must be adopted rather
    // than overwritten by the default on first launch.
    engineBag = { historyMax: 45 };
    assertEquals(freshStore().read().historyMax, 45);

    // Once the panel writes, the panel is the source of truth.
    const store = freshStore();
    store.write("historyMax", 60);
    engineBag = { historyMax: 45 };
    assertEquals(store.read().historyMax, 60);
});

Deno.test("the legacy autoRefreshMinutes name still sets the cadence", () => {
    reset();
    // Pre-`timeRange` installs stored the scan interval under this name; an
    // upgrade must not snap everyone's cadence back to the default.
    engineBag = { autoRefreshMinutes: 15 };
    assertEquals(freshStore().read().timeRange, 15);
});

Deno.test("a stored panel auto-minutes override is adopted once, then left alone", async () => {
    // The "Every" row used to keep its own `panelAutoMinutes` storage key, and
    // `intervalMs()` read that rather than the mod setting. Now that `timeRange`
    // persists, that key is folded in once so an upgrade does not reset anyone's
    // cadence to the default.
    reset();
    const { adoptLegacyAutoMinutes, getConfig, setSetting } = await import("./config.ts");

    storage.set(`${MOD}::panelAutoMinutes`, 15);
    adoptLegacyAutoMinutes(15);
    assertEquals(getConfig().timeRange, 15, "the old cadence was dropped");

    // A later edit in the panel must survive the next launch.
    setSetting("timeRange", 30);
    adoptLegacyAutoMinutes(15);
    assertEquals(getConfig().timeRange, 30, "the stale override clobbered a new choice");
});

Deno.test("garbage in storage falls back to the default instead of NaN", () => {
    reset();
    storage.set(`${MOD}::tracking`, { timeRange: "nonsense", historyMax: null });
    const read = freshStore().read();
    assertEquals(read.timeRange, TRACKING_FIELDS.timeRange.def);
    assertEquals(read.historyMax, TRACKING_FIELDS.historyMax.def);
});

Deno.test("the section is titled identically for both mods", () => {
    // The two settings tabs are meant to be the same section; the word mod used
    // to call it "Auto refresh" and the player mod "Tracking".
    assertEquals(TRACKING_SECTION, "Tracking Configuration");
});

Deno.test("the mod's setSetting persists through to storage", async () => {
    // The end-to-end path the user actually clicks. This is the test that fails
    // if `setSetting` is ever pointed back at `api.settings`: with no `set` on
    // the API, the old code re-read the engine bag and reported the old number,
    // so the stepper looked frozen.
    reset();
    const { getConfig, setSetting } = await import("./config.ts");

    assertEquals(getConfig().historyMax, 30, "unexpected starting point");

    setSetting("historyMax", 45);
    setSetting("maxCountSave", 300);

    assertEquals(getConfig().historyMax, 45, "getConfig did not see the new value");
    assertEquals(getConfig().maxCountSave, 300);

    // And it is genuinely on disk, not just in a cache that dies with the module.
    assertEquals(storage.get(`${MOD}::tracking`), { ...DEFAULTS, historyMax: 45, maxCountSave: 300 });
});

Deno.test("stored values agree with the mod's configSchema mirror", () => {
    // The panel reads the shared spec while `SETTINGS` in constants.ts mirrors
    // modinfo.json. If those drift, the row bounds and the schema disagree.
    for (const key of ["timeRange", "maxCountSave", "historyMax"] as const) {
        const spec = TRACKING_FIELDS[key];
        const schema = SETTINGS[key];
        assertEquals(spec.min, schema.min, `${key} min drifted`);
        assertEquals(spec.max, schema.max, `${key} max drifted`);
        assertEquals(spec.step, schema.step, `${key} step drifted`);
        assertEquals(spec.def, schema.default, `${key} default drifted`);
    }
});

Deno.test("both history sizes step by 10", () => {
    // These are window sizes, not precision knobs. A 1-at-a-time stepper across
    // 10–200 is unusable, so both rows move in tens.
    assertEquals(TRACKING_FIELDS.historyMax.step, 10);
    assertEquals(TRACKING_FIELDS.maxCountSave.step, 10);
});

Deno.test("no value is stranded between the floor and the default", () => {
    // A stepper that clamps at a value it can never step *back* to feels stuck.
    // With step 10 and min 10 the row parks cleanly on the floor; with min 5 it
    // used to clamp to a 5 that the next click pushed to 15.
    for (const key of ["historyMax", "maxCountSave"] as const) {
        const { min, step, def } = TRACKING_FIELDS[key];
        assertEquals(min % step, 0, `${key}: floor ${min} is not on the step grid`);
        assertEquals(def % step, 0, `${key}: default ${def} is not on the step grid`);
        assertEquals((def - min) % step, 0, `${key}: floor cannot reach the default in steps`);
    }
});