// @ts-nocheck
/**
 * The panel must survive a screen that throws while rendering.
 *
 * **1. A click event passed as a tab.** The list screen's `+ New` button was
 * wired as `onClick: startNew`. React calls a handler with the click event, and
 * `startNew`'s first parameter is the tab it should open — so `setCat` received
 * the event object. The type system saw nothing: `startNew`'s parameter is
 * `Tab`, but the event arrives as `any` through JSX props.
 *
 * That produced the reported symptoms in sequence. With no guard, the event was
 * not a key in `CATEGORY_META`, so `CATEGORY_META[event].label` threw and the
 * panel died. Adding a guard turned the crash into a *silent* wrong screen —
 * "New Terrain" opened "New Element" — which is worse, because a wrong screen
 * that looks right is harder to notice than a red one. So both halves matter:
 * the handler is wrapped, and the guard logs.
 *
 * **2. The panel being called rather than mounted.** `return Panel()` runs
 * `Panel`'s ~20 hooks against the injected component's fiber. It works, and it
 * is kept as an element anyway so a failed render cannot desync the next one —
 * but it was not the cause of anything above.
 */
import { assert, assertEquals } from "jsr:@std/assert";

// `../schema.ts` reaches for the host at import time, so the stub has to be in
// place before the import is awaited. Same shape as `screens.test.ts`.
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

/** The source with comments stripped, so prose about a pattern cannot match it. */
const code = panel
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

// ── the event-as-tab bug ──────────────────────────────────────────────────────

Deno.test("'+ New' is not wired to a bare handler that takes an argument", () => {
    // The specific regression: `onClick: startNew`. `startNew(tab)` is the only
    // handler in the panel with a first parameter, so it is the only one where a
    // bare reference silently means something else.
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
    // The value that actually arrives from a React onClick.
    const event = { type: "click", target: {}, nativeEvent: {}, preventDefault() {} };
    assertEquals(resolveCat(event), "elements");
    // …and it is not silently accepted as a tab.
    assert(!CATEGORY_META[event], "a click event must not be a valid category");
});

Deno.test("resolveCat rejects the other junk a handler can be handed", () => {
    assertEquals(resolveCat(undefined), "elements");
    assertEquals(resolveCat(null), "elements");
    assertEquals(resolveCat(""), "elements");
    assertEquals(resolveCat("nope"), "elements");
    assertEquals(resolveCat(7), "elements");
    // An array is a real object and a real wrong value — `attachedTo` returns one.
    assertEquals(resolveCat(["elements"]), "elements");
});

Deno.test("resolveCat warns, because a quiet fallback hid this bug", () => {
    // The regression that matters most: the guard turning a crash into a
    // confidently wrong screen. If this ever goes quiet again, the next
    // event-shaped bug will be invisible.
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
    // And it must not dump the whole event into the log.
    assert(
        !seen.some((m) => m.includes("preventDefault")),
        "the warning dumps the event object into the console",
    );
});

Deno.test("every category the menu can reach has screen metadata", () => {
    // The nav draws a chip per category, and the form screen reads
    // `CATEGORY_META[cat].label`. A category in one list and not the other is a
    // white screen, not a build error — this is the check for it.
    const missing: string[] = [];
    for (const g of MENU_GROUPS) {
        for (const c of g.categories) {
            if (!CATEGORY_META[c]) missing.push(`${g.key}/${c}`);
        }
    }
    assertEquals(missing, [], `categories with no CATEGORY_META: ${missing.join(", ")}`);
});

Deno.test("an unknown category falls back instead of crashing", () => {
    // The fallback itself must be a real screen, or it is just a different crash.
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
    // React is `sandkit.react`. There is no `api.react`; a fallback that looks
    // for one hides a missing host behind a second, wrong React.
    assert(
        !/api as \{ react\?:/.test(panel),
        "panel.ts still falls back to a nonexistent api.react",
    );
});
