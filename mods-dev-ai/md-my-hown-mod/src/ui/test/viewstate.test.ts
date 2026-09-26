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
import { emptyViewState, VOLATILE_KEYS } from "./viewstate.ts";

const panel = Deno.readTextFileSync(
    new URL("./panel.ts", import.meta.url).pathname,
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
