// @ts-nocheck
/**
 * A definition's own widget must survive the panel's generic dispatch chain.
 *
 * This exists because it did not. The chain is an if/else-if ladder whose
 * branches were only guarded on the *first* test, so a field a definition had
 * claimed (`shape`, `buildModes`) failed that test on `f.kind`, fell to the end
 * of the ladder, and had a plain text input assigned over the widget that had
 * just been built. The 4×4 grid and the build-modes editor both rendered as an
 * empty text box, while every other test still passed — nothing asserted on
 * what the control actually *was*.
 *
 * So this renders the real panel and inspects the produced element tree. A
 * source-text assertion would pass against the old code, because the old code
 * did call the definition's `renderField`; the widget was simply thrown away
 * afterwards.
 */
import { assert, assertEquals } from "jsr:@std/assert";

// ── a React stand-in that records the tree ───────────────────────────────────

interface Node {
    tag: string;
    props: Record<string, unknown>;
    children: unknown[];
}

const CFG = {
    structures: [{
        id: "s1",
        name: "Thing",
        shape: [[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    }],
    elements: [{
        id: "e1",
        name: "Goo",
        matterType: "powder",
        density: 100,
        colors: { variants: [[255, 0, 0, 255], [0, 255, 0, 200]] },
    }],
};

let nodes: Node[] = [];
let hooks: unknown[] = [];
let hookIdx = 0;

function h(tag: string, props: Record<string, unknown> | null, ...children: unknown[]) {
    const node: Node = { tag, props: props ?? {}, children };
    nodes.push(node);
    return node;
}

const React = {
    createElement: h,
    useState: (init: unknown) => {
        const i = hookIdx++;
        if (hooks.length <= i) hooks[i] = typeof init === "function" ? init() : init;
        return [hooks[i], (v: unknown) => {
            hooks[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(hooks[i]) : v;
        }];
    },
    useEffect: () => {},
    useRef: (v: unknown) => ({ current: v }),
    useCallback: (f: unknown) => f,
    useMemo: (f: () => unknown) => f(),
};

// `api.ts` binds `sandkit.api` when it is first imported, so the global has to
// exist before the panel is loaded. Storage is `get(modId, key)`.
globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_mod: string, key: string) => (key === "config" ? CFG : undefined),
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        elements: { list: () => [] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: React,
    enums: {},
};

const { createPanelComponent } = await import("../panel.ts");
const { entryToForm } = await import("../schema.ts");
const Panel = createPanelComponent(false);

// The hook list is panel-scoped state that persists across renders, exactly as
// React's does — resetting it per call would make every render see `cfg` as
// undefined. Only the counter restarts.
const cfg = { version: 1, ...CFG };
hooks = [false, cfg, "content", "elements", "list", {}, null, null, {}, "all"];

// hook order in panel.ts: 0 panel, 1 cfg, 2 groupKey, 3 cat, 4 mode, 5 form,
// 6 editingId
function renderFormFor(cat: string, entry: Record<string, unknown>, id: string) {
    hooks[3] = cat;
    hooks[4] = "form";
    hooks[5] = entryToForm(cat, entry);
    hooks[6] = id;
    hookIdx = 0;
    nodes = [];
    Panel();
    return nodes;
}

/** The element a field's cell actually rendered as its control. */
function controlOf(key: string): { tag: string; type?: string } | undefined {
    const cell = nodes.find((n) => n.props && n.props.key === key);
    const control = cell?.children?.[1] as Node | undefined;
    return control ? { tag: control.tag, type: control.props?.type as string } : undefined;
}

// ── the guard ────────────────────────────────────────────────────────────────

Deno.test("a definition's shape widget is not overwritten by the generic chain", () => {
    renderFormFor("structures", CFG.structures[0], "s1");
    const control = controlOf("shapeJson");
    assert(control, "the shape field rendered no control at all");
    assertEquals(
        control.tag,
        "div",
        "the 4×4 grid was replaced by a fallback control — a definition's own " +
            "widget is being discarded by the dispatch chain",
    );
});

Deno.test("a definition's build-modes editor is not overwritten either", () => {
    renderFormFor("structures", CFG.structures[0], "s1");
    const control = controlOf("buildModesJson");
    assert(control, "the build-modes field rendered no control at all");
    assertEquals(
        control.tag,
        "div",
        "the build-modes editor was replaced by a fallback control",
    );
});

Deno.test("the generic chain still handles kinds no definition claims", () => {
    // The guard must not disable the fallback: a plain text field is still a
    // text box, and a select is still a select.
    renderFormFor("structures", CFG.structures[0], "s1");
    const name = controlOf("name");
    assertEquals(name?.tag, "input");
    assertEquals(name?.type, "text");
});

Deno.test("the element colour swatches survive the same chain", () => {
    renderFormFor("elements", CFG.elements[0], "e1");
    const control = controlOf("colorsJson");
    assert(control, "the colour-variants field rendered no control at all");
    assertEquals(
        control.tag,
        "div",
        "the swatch list was replaced by a fallback control",
    );
});
