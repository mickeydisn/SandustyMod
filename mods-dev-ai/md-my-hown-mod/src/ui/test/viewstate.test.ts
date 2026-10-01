
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
    
    
    
    
    assertEquals(clean.listOwner, "own");
    assertEquals(clean.listHidden, false);
    assertEquals(clean.listQuery, "");
});

Deno.test("the list starts on 'own' and unticked, from one shared default", () => {
    
    
    
    
    assertEquals(LIST_DEFAULTS.listOwner, "own");
    assertEquals(LIST_DEFAULTS.listHidden, false);
    assertEquals(LIST_DEFAULTS.listQuery, "");

    
    assertEquals(emptyViewState().listOwner, LIST_DEFAULTS.listOwner);
    assertEquals(emptyViewState().listHidden, LIST_DEFAULTS.listHidden);
});

Deno.test("the panel initialises its list state from LIST_DEFAULTS, not a literal", () => {
    
    
    
    
    for (const field of ["listQuery", "listOwner", "listHidden"]) {
        assert(
            new RegExp(`useState[^(]*\\(\\s*LIST_DEFAULTS\\.${field}\\b`).test(panel),
            `panel.ts does not initialise ${field} from LIST_DEFAULTS`,
        );
    }
});

Deno.test("the hidden checkbox is drawn unconditionally, not behind a count", () => {
    
    
    
    
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
    
    assertEquals(
        bars.filter((b) => b.includes('type: "text"')).filter((b) => b.includes("hiddenToggle()"))
            .length,
        0,
        "the hidden tick is on the search bar as well as the filter row",
    );
});

Deno.test("every volatile field is actually applied in resetView", () => {
    
    
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
    
    
    for (const fn of ["goGroup", "goCategory"]) {
        const body = new RegExp(
            `const ${fn} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n        \\};`,
        ).exec(panel)?.[1];
        assert(body, `could not find ${fn} in panel.ts`);
        assert(/resetView\(\)/.test(body), `${fn} does not call resetView()`);
    }
});

Deno.test("neither navigation path resets state by hand any more", () => {
    
    
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
    
    
    assert(
        /key: `\$\{cat\}:\$\{mode\}`/.test(panel),
        "the body container is not keyed on cat+mode",
    );
});

Deno.test("renderField returns keyed children", () => {
    
    
    const ret = /const renderField = \(f: FieldSpec\) => \{[\s\S]*?\n        \};\n/
        .exec(panel)?.[0] ?? "";
    assert(ret, "could not find renderField");
    assert(/key: f\.key/.test(ret), "renderField does not key its root element");
});
