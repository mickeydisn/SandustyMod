

import { assert, assertEquals } from "jsr:@std/assert";



globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        elements: { list: () => [] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const { CATEGORY_META, MENU_GROUPS } = await import("../schema.ts");
const { resolveCat } = await import("../panel.ts");

const panel = Deno.readTextFileSync(
    new URL("../panel.ts", import.meta.url).pathname,
);


const code = panel
    .replace(/\/\*[\s\S]*?\*\
    .replace(/\/\/[^\n]*/g, "");



Deno.test("'+ New' is not wired to a bare handler that takes an argument", () => {
    
    
    
    assert(
        !/onClick: startNew\b/.test(code),
        "'+ New' is wired as onClick: startNew — the click event becomes the tab",
    );
    assert(
        /onClick: \(\) => startNew\(\)/.test(code),
        "'+ New' is not wrapped in an arrow",
    );
});

Deno.test("resolveCat keeps a real tab and rejects a click event", () => {
    assertEquals(resolveCat("terrains"), "terrains");
    assertEquals(resolveCat("contacts"), "contacts");
    
    const event = { type: "click", target: {}, nativeEvent: {}, preventDefault() {} };
    assertEquals(resolveCat(event), "elements");
    
    assert(!CATEGORY_META[event], "a click event must not be a valid category");
});

Deno.test("resolveCat rejects the other junk a handler can be handed", () => {
    assertEquals(resolveCat(undefined), "elements");
    assertEquals(resolveCat(null), "elements");
    assertEquals(resolveCat(""), "elements");
    assertEquals(resolveCat("nope"), "elements");
    assertEquals(resolveCat(7), "elements");
    
    assertEquals(resolveCat(["elements"]), "elements");
});

Deno.test("resolveCat warns, because a quiet fallback hid this bug", () => {
    
    
    
    const original = console.warn;
    const seen: string[] = [];
    console.warn = (...a: unknown[]) => seen.push(a.join(" "));
    try {
        resolveCat({ type: "click" });
        resolveCat("also-not-a-tab");
    } finally {
        console.warn = original;
    }
    assertEquals(seen.length, 2, "a bad category must log every time");
    assert(
        seen.every((m) => m.includes("unknown category")),
        `unexpected warning text: ${seen.join(" | ")}`,
    );
    
    assert(
        !seen.some((m) => m.includes("preventDefault")),
        "the warning dumps the event object into the console",
    );
});

Deno.test("every category the menu can reach has screen metadata", () => {
    
    
    
    const missing: string[] = [];
    for (const g of MENU_GROUPS) {
        for (const c of g.categories) {
            if (!CATEGORY_META[c]) missing.push(`${g.key}/${c}`);
        }
    }
    assertEquals(missing, [], `categories with no CATEGORY_META: ${missing.join(", ")}`);
});

Deno.test("an unknown category falls back instead of crashing", () => {
    
    assert(CATEGORY_META[resolveCat("nope")], "the fallback category has no metadata");
});

Deno.test("the panel guards its category lookup", () => {
    assert(
        /const cat = resolveCat\(rawCat\)/.test(code),
        "cat is not resolved through resolveCat",
    );
});

Deno.test("the panel is mounted, not called", () => {
    assert(
        !/return Panel\(\)/.test(code),
        "ConfiguratorPanel calls Panel() as a plain function — its hooks belong to the injected component",
    );
    assert(
        /h\(Panel as never, \{\}\)/.test(code),
        "Panel is not mounted as an element",
    );
});

Deno.test("no dead api.react fallback", () => {
    
    
    assert(
        !/api as \{ react\?:/.test(panel),
        "panel.ts still falls back to a nonexistent api.react",
    );
});
