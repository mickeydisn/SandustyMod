// @ts-nocheck: the host stub is a partial `sandkit`, and `schema.ts` reaches the
// engine through it on import. Same trade as `register/the-rest.test.ts`.
/**
 * Every entry in the shipped config must be **saveable** in the panel.
 *
 * The panel disables Save whenever `validateForm` reports anything, so an entry
 * that reads back with an unsatisfiable rule is an entry the author can open but
 * not save — and the only clue is a message about a field they never touched.
 * Three shipped entries were in exactly that state:
 *
 *   - every structure, because `unlockNode` is `required` and the config has
 *     none. `unlockNodeOf` treats an absent node as "available from the start",
 *     so the entry was valid and the form was not;
 *   - every sprite, because the `path` field is `kind: "library"` and the
 *     generated manifest only ever scanned `assets/icons/`, while this mod's
 *     structure art lives in `assets/artefact/`;
 *   - four `processing` entries, whose processes declared a `scope` that did not
 *     match the slot they were referenced from.
 *
 * The third one was not only a Save problem: `compileCustomProcess` enforces the
 * same scope check, so those processes were being refused at runtime too.
 *
 * These assertions are driven by the **real config file**, so a future edit that
 * reintroduces any of the three fails here rather than in the panel.
 *
 *     deno test --allow-read --allow-env src/config/panel-saveable.test.ts
 */
import { assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        sprites: { list: () => [] },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        elements: { list: () => [] },
        items: { list: () => [] },
        input: {},
        actions: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { entryToForm, validateForm, CATEGORY_META } = await import("../ui/schema.ts");
const { ProcessRegistry, setProcessRegistry } = await import(
    "../handler/custom-process/index.ts"
);
const { compileCustomProcess } = await import("../handler/custom-process/compile.ts");
const { listLibraryAssets } = await import("../catalog.ts");
const { DEFAULT_UNLOCK_NODE } = await import("../ui/tech-link.ts");

const CONFIG = JSON.parse(
    await Deno.readTextFile(
        new URL(
            "../../../md-random-artefact/config/random-artefact.json",
            import.meta.url,
        ),
    ),
);

/** Tabs that store something. `draws` is a catalogue with no storage. */
const STORED_TABS = Object.keys(CATEGORY_META).filter((t) => t !== "draws");

/** Stored entries across every tab, flattened. */
function storedEntries(): { tab: string; entry: Record<string, unknown> }[] {
    const out: { tab: string; entry: Record<string, unknown> }[] = [];
    for (const tab of STORED_TABS) {
        for (const entry of CONFIG[tab] ?? []) {
            if (entry && typeof entry === "object" && entry.id) out.push({ tab, entry });
        }
    }
    return out;
}

// The panel resolves `processId` and compiles against the registry the game
// installs at boot (`registerTheRest`). Both are installed here so the
// assertions see the same state the panel does.
setProcessRegistry(new ProcessRegistry(CONFIG.processes ?? []));

// ── the general property ──────────────────────────────────────────────────────

Deno.test("every stored entry can be opened and saved", () => {
    const broken: string[] = [];
    for (const { tab, entry } of storedEntries()) {
        const errors = validateForm(tab, entryToForm(tab, entry));
        for (const [key, message] of Object.entries(errors)) {
            broken.push(`${tab} / ${entry.id}: ${key} — ${message}`);
        }
    }
    assertEquals(broken, [], "entries the panel will refuse to save");
});

Deno.test("the config is not empty — the checks above are not passing on nothing", () => {
    // A guard on the guards: if the config ever lost its structures and sprites,
    // "every entry saves" would still be true and would mean nothing.
    assertEquals(storedEntries().length > 0, true, "no stored entries found");
    assertEquals((CONFIG.structures ?? []).length > 0, true, "no structures in the config");
    assertEquals((CONFIG.sprites ?? []).length > 0, true, "no sprites in the config");
});
// ── the three regressions, named ──────────────────────────────────────────────

Deno.test("a structure with no unlockNode still validates", () => {
    // The reported bug. `unlockNodeOf` resolves an absent node to the default
    // ("available from the start"), so the entry is valid; reading it as ""
    // tripped `required: true` and disabled Save for every structure.
    const form = entryToForm("structures", { id: "md-my-hown-mod:test", name: "Test" });
    assertEquals(form.unlockNode, DEFAULT_UNLOCK_NODE);
    assertEquals(validateForm("structures", form).unlockNode, undefined);
});

Deno.test("an explicit unlockNode is preserved, not overwritten by the default", () => {
    const form = entryToForm("structures", {
        id: "md-my-hown-mod:test",
        name: "Test",
        unlockNode: "md-my-hown-mod:unlock.custom",
    });
    assertEquals(form.unlockNode, "md-my-hown-mod:unlock.custom");
});

Deno.test("every shipped sprite path is a bundled asset the panel can accept", () => {
    // `kind: "library"` validation resolves against this list, so a path the
    // generator did not emit is a sprite that cannot be saved. The generator
    // used to walk only `assets/icons/`, which excluded this mod's own art.
    const known = new Set(listLibraryAssets().map((a) => a.path));
    const missing = (CONFIG.sprites ?? [])
        .map((s) => s.path)
        .filter((p) => p && !known.has(p));
    assertEquals(missing, [], "sprite paths absent from the generated library");
});

Deno.test("every process reference compiles in the slot that uses it", () => {
    // Not a Save-only check: `compileCustomProcess` refuses the same mismatch,
    // so a bad scope means the process never ran in the game either.
    const registry = new ProcessRegistry(CONFIG.processes ?? []);
    const refused: string[] = [];
    for (
        const [listName, slot] of [
            ["processing", "processing"],
            ["signals", "signal"],
            ["triggers", "trigger"],
        ]
    ) {
        for (const entry of CONFIG[listName] ?? []) {
            if (!entry.processId) continue;
            let failure = null;
            compileCustomProcess(registry, entry.processId, slot, (f) => {
                failure = `${f.id}: ${f.error}`;
            });
            if (failure) refused.push(`${entry.id} (${slot}) -> ${failure}`);
        }
    }
    assertEquals(refused, [], "process references the compiler refused");
});

Deno.test("a signal's process keeps its signal scope", () => {
    // The fix for the link processes was to add a processing-scoped twin, NOT to
    // retag the original. Had the originals been repointed instead, the three
    // signals would silently stop firing — a quiet loss that compiles cleanly.
    const scopes = new Map((CONFIG.processes ?? []).map((p) => [p.id, p.scope]));
    for (const signal of CONFIG.signals ?? []) {
        assertEquals(
            scopes.get(signal.processId),
            "signal",
            `signal ${signal.id} points at a ${scopes.get(signal.processId)}-scoped process`,
        );
    }
});
