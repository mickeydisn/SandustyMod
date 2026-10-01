

import { assert, assertEquals } from "jsr:@std/assert";



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
    recipes: [{
        id: "r1",
        kind: "smelter",
        input: "md-my-hown-mod:ore",
        outputs: [{ elementType: "md-my-hown-mod:ingot", chance: 1 }],
    }],
    excavation: [{
        id: "x1",
        power: 25,
        pattern: [[1, 1], [0, 1]],
        terrainRules: [
            { cellType: "md-my-hown-mod:stone", damage: 3 },
        ],
    }],
    projectiles: [{
        id: "p1",
        sprite: { id: "sprites:bolt" },
        options: { speed: 10 },
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




const cfg = { version: 1, ...CFG };
hooks = [false, cfg, "content", "elements", "list", {}, null, null, {}, "all"];



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


function controlOf(key: string): { tag: string; type?: string } | undefined {
    const cell = nodes.find((n) => n.props && n.props.key === key);
    const control = cell?.children?.[1] as Node | undefined;
    return control ? { tag: control.tag, type: control.props?.type as string } : undefined;
}


function isPicker(key: string): boolean {
    const cell = nodes.find((n) => n.props && n.props.key === key);
    const control = cell?.children?.[1] as Node | undefined;
    if (!control) return false;
    if (control.tag === "select") return true;
    if (control.tag !== "div") return false;
    return (control.children ?? []).some((c) => (c as Node)?.tag === "button");
}



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
    
    
    
    
    renderFormFor("items", CFG.items[0], "i1");
    assertEquals(controlOf("itemType")?.tag, "select", "itemType is not a dropdown");
    assertEquals(controlOf("cooldownMs")?.tag, "input", "cooldownMs is not a number box");
    assert(isPicker("spriteId"), "spriteId is not a picker");
    assertEquals(controlOf("spriteType")?.tag, "select", "spriteType is not a dropdown");
    assertEquals(controlOf("excavationProfileId")?.tag, "select");
    
    
    
    assertEquals(controlOf("advancedJson"), undefined, "an empty passthrough box is showing");
});

Deno.test("an item's conditional fields appear only for their own item type", () => {
    
    
    
    renderFormFor("items", CFG.items[0], "i1"); 
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
    
    
    
    
    renderFormFor("terrains", CFG.terrains[0], "t1");
    assert(controlOf("colorHSLHue"), "the hue box is missing for a terrain with colorHSL");
    assert(controlOf("colorHSLSaturation"), "the saturation box is missing");
    assert(controlOf("colorHSLLightness"), "the lightness box is missing");
    
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

Deno.test("the recipe's output row editor survives the chain", () => {
    
    
    
    
    renderFormFor("recipes", CFG.recipes[0], "r1");
    const control = controlOf("outputs");
    assert(control, "the outputs field rendered no control at all");
    assertEquals(
        control.tag,
        "div",
        "the output row editor was replaced by a fallback control",
    );
});

Deno.test("a recipe's output shape follows its machine", () => {
    
    
    
    renderFormFor("recipes", CFG.recipes[0], "r1"); 
    assert(controlOf("outputs"), "a smelter lost its output list");
    assertEquals(controlOf("outputElement"), undefined, "a smelter was offered a single output");

    hooks[5] = { ...hooks[5], machine: "planterBox" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("outputElement"), "a planterBox lost its single output");
    assert(controlOf("outputChance"), "a planterBox lost its output chance");
    assertEquals(controlOf("outputs"), undefined, "a planterBox was offered a list");

    hooks[5] = { ...hooks[5], machine: "shaker" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("outputsAbove"), "a shaker lost its 'above' list");
    assert(controlOf("outputsBelow"), "a shaker lost its 'below' list");
    assertEquals(controlOf("outputs"), undefined, "a shaker was offered the single list");

    hooks[5] = { ...hooks[5], machine: "kineticPress" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("minVelocity"), "a kineticPress lost its minimum velocity");
});

Deno.test("the excavation rule editor survives the chain", () => {
    
    
    
    
    renderFormFor("excavation", CFG.excavation[0], "x1");
    const control = controlOf("terrainRulesJson");
    assert(control, "the terrain-rules field rendered no control at all");
    assertEquals(
        control.tag,
        "div",
        "the terrain-rule editor was replaced by a fallback control",
    );
    
    
    assertEquals(controlOf("patternJson")?.tag, "textarea");
});

Deno.test("a projectile's static options hide behind its option", () => {
    
    
    
    
    renderFormFor("projectiles", CFG.projectiles[0], "p1");
    assert(controlOf("optionsJson"), "the static options box is missing");
    assert(isPicker("spriteId"), "spriteId is not a picker");

    hooks[5] = { ...hooks[5], optionKey: "projectileHeavy" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assertEquals(
        controlOf("optionsJson"),
        undefined,
        "the static options box is showing behind an option",
    );

    
    
    
    hooks[5] = { ...hooks[5], optionKey: "" };
    hookIdx = 0;
    nodes = [];
    Panel();
    assert(controlOf("optionsJson"), "no option should not hide the static box");
});

Deno.test("a signal renders its two dropdowns and no third handler dropdown", () => {
    
    
    
    
    
    
    
    
    
    
    renderFormFor("signals", { id: "s2", kind: "targets" }, "s2");
    assertEquals(controlOf("kind")?.tag, "select");
    assert(isPicker("target"), "target is not a picker");
    assertEquals(controlOf("handlerKey"), undefined, "the single handler control is gone");
});
