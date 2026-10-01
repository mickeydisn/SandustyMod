


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


const STORED_TABS = Object.keys(CATEGORY_META).filter((t) => t !== "draws");


function storedEntries(): { tab: string; entry: Record<string, unknown> }[] {
    const out: { tab: string; entry: Record<string, unknown> }[] = [];
    for (const tab of STORED_TABS) {
        for (const entry of CONFIG[tab] ?? []) {
            if (entry && typeof entry === "object" && entry.id) out.push({ tab, entry });
        }
    }
    return out;
}




setProcessRegistry(new ProcessRegistry(CONFIG.processes ?? []));



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
    
    
    assertEquals(storedEntries().length > 0, true, "no stored entries found");
    assertEquals((CONFIG.structures ?? []).length > 0, true, "no structures in the config");
    assertEquals((CONFIG.sprites ?? []).length > 0, true, "no sprites in the config");
});


Deno.test("a structure with no unlockNode still validates", () => {
    
    
    
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
    
    
    
    const known = new Set(listLibraryAssets().map((a) => a.path));
    const missing = (CONFIG.sprites ?? [])
        .map((s) => s.path)
        .filter((p) => p && !known.has(p));
    assertEquals(missing, [], "sprite paths absent from the generated library");
});

Deno.test("every process reference compiles in the slot that uses it", () => {
    
    
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
    
    
    
    const scopes = new Map((CONFIG.processes ?? []).map((p) => [p.id, p.scope]));
    for (const signal of CONFIG.signals ?? []) {
        assertEquals(
            scopes.get(signal.processId),
            "signal",
            `signal ${signal.id} points at a ${scopes.get(signal.processId)}-scoped process`,
        );
    }
});
