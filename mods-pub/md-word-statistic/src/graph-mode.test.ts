/**
 * The accumulated / diff graph toggle.
 *
 * The two mods used to disagree: player plotted per-interval change, world
 * plotted accumulated totals. Both now share `applyGraphMode`, so these tests
 * pin the one behaviour both depend on — and `rawPointsFor`, the off-by-one
 * that decides whether the plot renders one point short of the requested width.
 */
// @ts-nocheck: a partial `sandkit` global; this file never touches the APIs it
// does not stub.
import { assertEquals } from "jsr:@std/assert@1";

globalThis.sandkit = {
    api: {
        storage: { get: () => undefined, set: () => {}, remove: () => {} },
        settings: { get: () => undefined, getAll: () => ({}), onChange: () => {} },
    },
    ui: { toast: () => {} },
    events: { on: () => {} },
};

const { applyGraphMode, GRAPH_MODE_LABELS, lastDelta, rawPointsFor } = await import("@sandmd/ui");

const HISTORY = [10, 25, 30, 48, 61, 70];

Deno.test("total mode returns the history untouched", () => {
    assertEquals(applyGraphMode(HISTORY, "total"), HISTORY);
});

Deno.test("diff mode returns the change between consecutive samples", () => {
    assertEquals(applyGraphMode(HISTORY, "diff"), [15, 5, 18, 13, 9]);
});

Deno.test("diff mode drops the first sample, so it needs one extra", () => {
    // The first sample has no predecessor to subtract. That is exactly why
    // `rawPointsFor` asks for one more raw point in diff mode — without it the
    // plot would come up a point short of the configured window.
    assertEquals(
        applyGraphMode(HISTORY, "diff").length,
        HISTORY.length - 1,
    );
    assertEquals(rawPointsFor(30, "diff"), 31);
    assertEquals(rawPointsFor(30, "total"), 30);
});

Deno.test("a full window stays full in both modes", () => {
    // `rawPointsFor` only pays off when the history is actually long enough, so
    // this uses a longer history than the requested window — the real case.
    const long = Array.from({ length: 50 }, (_, i) => i * 3);
    for (const mode of ["total", "diff"]) {
        const raw = long.slice(-rawPointsFor(30, mode));
        assertEquals(
            applyGraphMode(raw, mode).length,
            30,
            `${mode} rendered a short plot`,
        );
    }
});

Deno.test("the window shrinks honestly when history is too short", () => {
    // With fewer samples than the window asks for there is nothing to invent:
    // total yields all N, diff yields N-1 because the first has no predecessor.
    const short = HISTORY;
    assertEquals(applyGraphMode(short, "total").length, short.length);
    assertEquals(applyGraphMode(short, "diff").length, short.length - 1);
});

Deno.test("a counter reset reads as a flat interval, not a negative spike", () => {
    // Wipe all data / a new session can drop a cumulative counter below the
    // previous sample. `toIntervals` floors at zero so the dip does not wreck
    // the y-axis of every series on the chart.
    assertEquals(applyGraphMode([100, 20, 35], "diff"), [0, 15]);
});

Deno.test("both modes have a caption and a hint", () => {
    assertEquals(GRAPH_MODE_LABELS.total, "Total");
    assertEquals(GRAPH_MODE_LABELS.diff, "Diff");
});

Deno.test("the card badge is the change between the last two points", () => {
    // The badge used to be a whole-session counter (player) or everything since
    // the first-ever scan (world), both labelled "session". It is now the diff
    // of the final two samples — the same number as the last sparkline bar.
    assertEquals(lastDelta([10, 25, 30, 48, 61, 70]), 9);
    assertEquals(lastDelta([5]), null, "one sample cannot produce a rate");
    assertEquals(lastDelta([]), null);
    assertEquals(lastDelta([4, 4]), 0, "a flat pair is a real zero, not missing data");
});

Deno.test("the badge matches the last bar of the diff sparkline", () => {
    // These must agree, or the number under the graph contradicts the graph.
    const raw = [10, 25, 30, 48, 61, 70];
    assertEquals(lastDelta(raw), applyGraphMode(raw, "diff").at(-1));
});