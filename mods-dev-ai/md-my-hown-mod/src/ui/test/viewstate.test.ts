/**
 * Regression test for the stale-panel-switch bug.
 *
 * The symptom was a panel that did not fully change: the Structure form's
 * Placement and Render sections lingered after switching away. Two independent
 * causes, and this file pins both.
 *
 * The first is a *decision* bug — the list of what a screen change clears lived
 * in two navigation functions and each one had forgotten a field. That is now
 * one list, checked here against the code that applies it.
 *
 * The second is a *reconciliation* bug — the body container was unkeyed, so
 * React patched the old screen's DOM into the new one instead of remounting.
 * That cannot be exercised without a renderer, so the key is asserted textually.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { emptyViewState, LIST_DEFAULTS, VOLATILE_KEYS } from "../viewstate.ts";

const panel = Deno.readTextFileSync(
    new URL("../panel.ts", import.meta.url).pathname,
);

Deno.test("emptyViewState clears every volatile field", () => {
    const clean = emptyViewState();
    assertEquals(clean.mode, "list");
    assertEquals(clean.form, {});
    assertEquals(clean.editingId, null);
    assertEquals(clean.confirmId, null);
    assertEquals(clean.jsonText, "");
    assertEquals(clean.jsonError, null);
    assertEquals(clean.libQuery, {});
    assertEquals(clean.handlerTab.open, null);
    assertEquals(clean.handlerTab.values, {});
    // The list starts narrowed to what the user can edit, and with hidden
    // objects out. Both are *defaults*, not "cleared" — a category change
    // returns to this, so a user filtering to another mod in Elements does not
    // silently stay narrowed in Terrains.
    assertEquals(clean.listOwner, "own");
    assertEquals(clean.listHidden, false);
    assertEquals(clean.listQuery, "");
});

Deno.test("the list starts on 'own' and unticked, from one shared default", () => {
    // These used to be two literals — one in the `useState` initializer, one in
    // `emptyViewState` — and this test matched both as *source text*, which
    // `deno fmt` could break and which proved nothing about the values. Now both
    // read `LIST_DEFAULTS`, so asserting the constant is asserting both sites.
    assertEquals(LIST_DEFAULTS.listOwner, "own");
    assertEquals(LIST_DEFAULTS.listHidden, false);
    assertEquals(LIST_DEFAULTS.listQuery, "");

    // And the reset really does start from it, rather than merely agreeing.
    assertEquals(emptyViewState().listOwner, LIST_DEFAULTS.listOwner);
    assertEquals(emptyViewState().listHidden, LIST_DEFAULTS.listHidden);
});

Deno.test("the panel initialises its list state from LIST_DEFAULTS, not a literal", () => {
    // The remaining half of the old guarantee, and the only part that still has
    // to be textual: `panel.ts` must actually *use* the constant. Matching the
    // call sites by name is stable against reformatting, which matching the
    // whole `useState(...)` expression was not.
    for (const field of ["listQuery", "listOwner", "listHidden"]) {
        assert(
            new RegExp(`useState[^(]*\\(\\s*LIST_DEFAULTS\\.${field}\\b`).test(panel),
            `panel.ts does not initialise ${field} from LIST_DEFAULTS`,
        );
    }
});

Deno.test("the hidden checkbox is drawn unconditionally, not behind a count", () => {
    // It used to render only when the category had hidden rows, which meant it
    // vanished on a fresh install and on Terrains/Items. A control that appears
    // and disappears is one the user cannot rely on; the count beside the label
    // tells them whether ticking it would do anything.
    assert(
        /hiddenToggle\(\)/.test(panel),
        "the hidden toggle is not rendered",
    );
    assert(
        !/hiddenHere\s*\?\s*hiddenToggle\(\)\s*:\s*null/.test(panel),
        "the hidden toggle is still gated on there being hidden rows",
    );
});

Deno.test("the hidden tick sits with the owner chips, not on the search box", () => {
    // The three controls are one row of filters. Splitting the hidden tick onto
    // the search bar put the only two *filters* on different rows, which is what
    // made the screen read as cluttered.
    //
    // Checked by locating the bar that renders `hiddenToggle()` and requiring the
    // owner chips to be in that same `h(` call — not by looking for the toggle
    // anywhere, which is what the previous version of this test did and which
    // would pass just as happily on the search box.
    const bars = [
        ...panel.matchAll(/h\(\s*"div",\s*\{ style: S\.listFilterBar \},([\s\S]*?)\n {16}\),/g),
    ]
        .map((m) => m[1] ?? "");
    const withHidden = bars.filter((b) => b.includes("hiddenToggle()"));
    assertEquals(withHidden.length, 1, "expected exactly one filter bar with the hidden tick");
    assert(
        withHidden[0].includes("ownerChip("),
        "the hidden tick is not in the same bar as the owner chips",
    );
    // And it is not also on the search box, which would render it twice.
    assertEquals(
        bars.filter((b) => b.includes('type: "text"')).filter((b) => b.includes("hiddenToggle()"))
            .length,
        0,
        "the hidden tick is on the search bar as well as the filter row",
    );
});

Deno.test("every volatile field is actually applied in resetView", () => {
    // The guard against the original bug: a new piece of view state gets added
    // to VOLATILE_KEYS, and if nobody wires it into resetView this fails.
    const body = /const resetView = useCallback\(\(\) => \{([\s\S]*?)\n        \}, \[\]\);/
        .exec(panel)?.[1];
    assert(body, "could not find resetView in panel.ts");
    for (const key of VOLATILE_KEYS) {
        assert(
            new RegExp(`set[A-Z]\\w*\\(\\s*clean\\.${key}\\b`).test(body),
            `resetView does not reset "${key}"`,
        );
    }
});

Deno.test("both navigation paths go through the one reset", () => {
    // Two reset paths is the structural cause of the original bug: the second
    // one is a second place to forget.
    for (const fn of ["goGroup", "goCategory"]) {
        const body = new RegExp(
            `const ${fn} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n        \\};`,
        ).exec(panel)?.[1];
        assert(body, `could not find ${fn} in panel.ts`);
        assert(/resetView\(\)/.test(body), `${fn} does not call resetView()`);
    }
});

Deno.test("neither navigation path resets state by hand any more", () => {
    // If someone re-adds a bare setMode/setForm to a navigation function, the
    // reset stops being the single source of truth and the bug can return.
    for (const fn of ["goGroup", "goCategory"]) {
        const body = new RegExp(
            `const ${fn} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n        \\};`,
        ).exec(panel)?.[1] ?? "";
        const bare = body.split("\n").filter((l) =>
            /^\s+set[A-Z]\w*\(/.test(l) && !/setGroupKey|setCat\(/.test(l)
        );
        assertEquals(bare, [], `${fn} resets state outside resetView: ${bare}`);
    }
});

Deno.test("the screen body is keyed so it remounts instead of reconciling", () => {
    // Without a key, React patches the old screen's DOM into the new one and
    // anything holding DOM state survives the switch.
    assert(
        /key: `\$\{cat\}:\$\{mode\}`/.test(panel),
        "the body container is not keyed on cat+mode",
    );
});

Deno.test("renderField returns keyed children", () => {
    // Regression guard: unkeyed children in a list let React mismatch nodes
    // when the field set changes between screens.
    const ret = /const renderField = \(f: FieldSpec\) => \{[\s\S]*?\n        \};\n/
        .exec(panel)?.[0] ?? "";
    assert(ret, "could not find renderField");
    assert(/key: f\.key/.test(ret), "renderField does not key its root element");
});
