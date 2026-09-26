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
    items: [{
        id: "i1",
        name: "Pick",
        itemType: "Tool",
        cooldown: 250,
        excavationProfileId: "md-my-hown-mod:dig",
        sprite: { id: "sprites:pick", type: "onehand" },
    }],
    terrains: [{
        id: "t1",
        name: "Stone",
        hp: 250,
        colorHSL: [200, 0.4, 0.6],
        output: { elementType: "md-my-hown-mod:pebble", chance: 0.25 },
        materialId: 101,
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

Deno.test("a definition with no widget of its own still renders every control", () => {
    // Items claims no field kind, so every control comes from the generic
    // chain. That is exactly the case where a definition is *silently* absent:
    // a missing `fields` entry and a missing widget look the same on screen.
    // So the item's fields are asserted to be present and of the right kind.
    renderFormFor("items", CFG.items[0], "i1");
    assertEquals(controlOf("itemType")?.tag, "select", "itemType is not a dropdown");
    assertEquals(controlOf("cooldownMs")?.tag, "input", "cooldownMs is not a number box");
    assertEquals(controlOf("spriteId")?.tag, "select", "spriteId is not a dropdown");
    assertEquals(controlOf("spriteType")?.tag, "select", "spriteType is not a dropdown");
    assertEquals(controlOf("excavationProfileId")?.tag, "select");
    // The passthrough box is deliberately *conditional* — it appears only when it
    // is carrying something — so an item with no hidden keys must not show it.
    // Asserted because that is the designed behaviour, not an omission.
    assertEquals(controlOf("advancedJson"), undefined, "an empty passthrough box is showing");
});

Deno.test("an item's conditional fields appear only for their own item type", () => {
    // A Tool shows the profile and hides the projectile; a Weapon is the
    // reverse. Getting this backwards offers a Weapon a digging profile, which
    // is a stored reference to something that cannot work.
    renderFormFor("items", CFG.items[0], "i1"); // itemType: Tool
    assert(controlOf("excavationProfileId"), "a Tool lost its excavation profile");
    assertEquals(controlOf("projectileId"), undefined, "a Tool was offered a projectile");

    hooks[5] = { ...hooks[5], itemType: "Weapon" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("projectileId"), "a Weapon lost its projectile");
    assertEquals(controlOf("excavationProfileId"), undefined, "a Weapon was offered a profile");

    hooks[5] = { ...hooks[5], itemType: "Consumable" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assertEquals(controlOf("handlerKey"), undefined, "a Consumable was offered a use action");
});

Deno.test("a terrain's HSL controls follow the toggle", () => {
    // The stored `[200, 0.4, 0.6]` must arrive as three filled number boxes
    // with the toggle on — the form's way of saying "this tile has a base
    // colour". If the toggle were off, the author would see a colourless tile
    // and could not tell that the config actually carries one.
    renderFormFor("terrains", CFG.terrains[0], "t1");
    assert(controlOf("colorHSLHue"), "the hue box is missing for a terrain with colorHSL");
    assert(controlOf("colorHSLSaturation"), "the saturation box is missing");
    assert(controlOf("colorHSLLightness"), "the lightness box is missing");
    // `colorHSLOn` is a bool, so it renders through the generic chain too
    assert(controlOf("colorHSLOn"), "the HSL toggle is missing");

    hooks[5] = { ...hooks[5], colorHSLOn: "false" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("colorHSLOn"), "the toggle disappeared with the colour off");
    assertEquals(
        controlOf("colorHSLHue"),
        undefined,
        "the hue box is showing while the HSL toggle is off",
    );
});

Deno.test("a terrain's drop chance follows its drop element", () => {
    // A chance with no element is a drop of nothing, so the control is hidden
    // rather than inviting a number that cannot mean anything.
    renderFormFor("terrains", CFG.terrains[0], "t1");
    assert(controlOf("outputElement"), "the drop picker is missing");
    assert(controlOf("outputChance"), "the drop chance is missing for a terrain that drops");

    hooks[5] = { ...hooks[5], outputElement: "" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("outputElement"), "the drop picker disappeared");
    assertEquals(
        controlOf("outputChance"),
        undefined,
        "a drop chance is offered for a terrain that drops nothing",
    );
});
