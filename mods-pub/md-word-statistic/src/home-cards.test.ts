/**
 * The Home card layout must survive a scan that runs before the panel mounts.
 *
 * Regression: `state.cards` used to be filled by the overlay's mount effect
 * only, and `bootFromStorage` bailed out entirely the moment a snapshot
 * existed. The boot auto-refresh runs on its own, so a small world finished
 * scanning before the panel ever mounted — the scan then resolved the Home
 * cards from an empty list and the tab showed "No cards configured" for the
 * rest of the session. Reopening the tool could not rescue it either: the
 * cards had gone missing from memory, not from storage.
 *
 * The tests share one module instance on purpose. `ensureCardsLoaded` latches
 * the stored layout once per session, so the boot scan below has to run before
 * anything else asks for cards, and the later tests assert on what it left.
 *
 * `@sandmd/ui` reads `sandkit` at module load, so the stub has to be in place
 * before the imports — hence the dynamic imports below.
 */
// @ts-nocheck: the stub is a partial `sandkit` global with deliberately loose
// shapes; type-checking it would assert against APIs this file never touches.
import { assert, assertEquals } from "jsr:@std/assert@1";

const MOD = "md-word-statistic";
const store = new Map();
const settings = { enabled: true, timeRange: 2, maxCountSave: 120, historyMax: 30 };

const ELEMENT_IDS = { 1: "gold", 2: "water", 3: "wetsand" };
const ELEMENT_NAMES = { 1: "Gold", 2: "Water", 3: "Wet Sand" };
const TERRAIN_IDS = { 0: "air", 1: "stone", 2: "dirt" };
const TERRAIN_NAMES = { 0: "Air", 1: "Stone", 2: "Dirt" };
const byId = (table: Record<string, unknown>, id: string) =>
    Object.keys(table).find((k) => table[k] === id);

globalThis.sandkit = {
    api: {
        storage: {
            get: (mod: string, k: string) => store.get(`${mod}::${k}`),
            set: (mod: string, k: string, v: unknown) => void store.set(`${mod}::${k}`, v),
            remove: (mod: string, k: string) => void store.delete(`${mod}::${k}`),
        },
        settings: {
            get: (n: string) => settings[n],
            set: (n: string, v: unknown) => void (settings[n] = v),
            onChange: () => {},
        },
        ui: { toast: () => {}, overlays: { register: () => {}, update: () => {} } },
        events: { on: () => {} },
        // 4x2 world: column 0 holds gold, the rest water, all on dirt.
        grid: { getDimensions: () => ({ widthCells: 4, heightCells: 2 }) },
        elements: {
            getRegisteredTypes: () => [1, 2, 3],
            getDefinitionByType: (t: number) => ({
                id: ELEMENT_IDS[t],
                name: ELEMENT_NAMES[t],
                metaColor: t === 1 ? 0xffd700 : 0x8ab4f8,
            }),
            getNameByType: (t: number) => ELEMENT_NAMES[t],
            getTypeAtCell: (x: number) => (x === 0 ? 1 : 2),
            getTypeFromId: (id: string) => Number(byId(ELEMENT_IDS, id)),
        },
        terrains: {
            getRegisteredTypes: () => [0, 1, 2],
            getIdByType: (t: number) => TERRAIN_IDS[t],
            getNameByType: (t: number) => TERRAIN_NAMES[t],
            getDefinitionByType: (t: number) => ({
                id: TERRAIN_IDS[t],
                name: TERRAIN_NAMES[t],
                metaColor: 0x8b7355,
            }),
            getTypeAtCell: () => 2,
            getTypeFromId: (id: string) => Number(byId(TERRAIN_IDS, id)),
        },
        structures: { getAvailableTypes: () => [], forEachOfType: () => {} },
        world: { isCellEmptyAtCell: () => false },
    },
};

const { runRefresh } = await import("./refresh.ts");
const { bootFromStorage, bump, state } = await import("./state.ts");
const { loadCards } = await import("./cards.ts");

const key = (k: string) => `${MOD}::${k}`;
const STORED_CARDS = [{
    id: "card-gold",
    title: "My Gold",
    items: [{ kind: "element", id: "gold" }],
}];

Deno.test("a boot scan finishing before the panel mounts keeps the configured cards", async () => {
    // Nothing has mounted the overlay yet, so only the scan can fill state.cards.
    store.set(key("homeCards"), STORED_CARDS);
    assertEquals(state.snapshot, null);
    assertEquals(state.cards, []);

    await runRefresh("load");

    const cards = state.snapshot.cards;
    assertEquals(cards.length, 1, "the scan resolved no cards — the reported bug");
    assertEquals(cards[0].title, "My Gold");
    // Two gold cells in the 4x2 world: the layout resolved against live data.
    assertEquals(cards[0].items[0].label, "Gold");
    assertEquals(cards[0].items[0].count, 2);
    assertEquals(cards[0].total, 2);
});

Deno.test("a panel mounting after that scan still applies chrome prefs and cards", () => {
    // The old early return skipped loadChrome, so a minimised panel came back at
    // its defaults and the stored layout was never read into memory.
    store.set(key("panelMinimized"), true);
    store.set(key("panelZoom"), 1.25);

    bootFromStorage();

    assertEquals(state.minimized, true);
    assertEquals(state.zoom, 1.25);
    assertEquals(state.cards.length, 1);
    assertEquals(state.snapshot.cards.length, 1);
});

Deno.test("editing the layout re-resolves the cards without a rescan", () => {
    const scanned = state.snapshot;
    state.cards = [{ ...STORED_CARDS[0], title: "Renamed" }];
    bump();

    assertEquals(state.snapshot.cards[0].title, "Renamed");
    assertEquals(state.snapshot.cards[0].total, 2, "counts still come from the last scan");
    assert(state.snapshot !== scanned, "re-resolving replaces the snapshot object");
});

Deno.test("discarding an edit reverts the home tab to the stored layout", () => {
    state.cards = [{ ...STORED_CARDS[0], title: "Never saved" }];
    bump();
    assertEquals(state.snapshot.cards[0].title, "Never saved");

    // "Discard" re-reads the stored list; "Save" is the only writer.
    state.cards = loadCards();
    bump();
    assertEquals(state.snapshot.cards[0].title, "My Gold");
});

Deno.test("loading cards from an empty store offers defaults without writing them", () => {
    store.delete(key("homeCards"));

    const cards = loadCards();

    assert(cards.length > 0, "defaults are still offered to a fresh install");
    // Persisting here would overwrite a real layout whenever the store is not
    // readable yet, and would bake in a half-registered catalogue.
    assertEquals(store.get(key("homeCards")), undefined);
});

Deno.test("a deliberately cleared card list is honoured", () => {
    store.set(key("homeCards"), []);

    assertEquals(loadCards(), [], "an empty list is a choice, not a missing value");
});
