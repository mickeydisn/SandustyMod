import { assert, assertEquals } from "jsr:@std/assert@1";
import { formatIdList, parseIdList } from "../../../definition/values.ts";

// `schema.ts` and the definitions both reach `api.ts`, which reads the engine's
// `sandkit` global at *import* time — and a static import hoists above anything
// written here. So the stub has to be in place first, and those two come in
// afterwards as dynamic imports. Same stub shape as `src/ui/test/draw.test.ts`.
//
// The engine half is *not* empty: `listElements` and `listStructures` read the
// registries, and an empty stub makes every content field resolve to `[]`, which
// the selector classifies as "nothing to pick from" rather than "content". With
// nothing there, this test would pass while proving the wiring covers one field.
const store: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_m: string, k: string) => store[k],
            set: (_m: string, k: string, v: unknown) => {
                store[k] = v;
            },
            remove: (_m: string, k: string) => {
                delete store[k];
            },
        },
        ui: { toast: () => {} },
        elements: {
            getRegisteredTypes: () => [0, 1],
            getDefinitionByType: (t: number) =>
                t === 0
                    ? { id: "Sand", name: "Sand", metaColor: 0xd8c07a }
                    : { id: "Furnace", name: "Furnace", metaColor: 0x888888 },
        },
        structures: {
            getAvailableTypes: () => new Set(["Furnace"]),
            getDefinitionByType: () => ({ id: "Furnace", name: "Furnace" }),
        },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
    react: { createElement: () => null },
    enums: {},
};

const {
    isContentField,
    renderSelector,
    selectorKey,
} = await import("./selector.ts");
import type { SelectorState } from "./selector.ts";
const { resolveOptions } = await import("../../../schema.ts");
const { DEFINITIONS } = await import("../../../definition/index.ts");
const { listElements, listStructures, listMatterTypes, listKeyCodes } = await import(
    "../../../../catalog.ts"
);

Deno.test("an element list is content, so the selector takes it", () => {
    assert(isContentField(listElements));
});

Deno.test("a structure list is content even when nothing is namespaced", () => {
    // The regression this guards: a data-shape guess ("has a colour, or a dot in
    // the id") rejects the game's own `Furnace`, because it is unnamespaced and
    // has no swatch. That left behaviors.structureId and energy.structureId on the
    // old picker — the most-used reference fields in the panel.
    assert(isContentField(listStructures));
});

Deno.test("a fixed engine enum is not content", () => {
    // "conductor"/"storage" are values the engine defined, not objects a mod adds.
    // Giving these the full picker would be a widget that does nothing.
    assertEquals(isContentField(listMatterTypes), false);
});

Deno.test("a handler-key list is not content", () => {
    assertEquals(isContentField(listKeyCodes), false);
});

Deno.test("a literal option array is never content", () => {
    // A fixed list has no resolver behind it, so there is nothing that could
    // decide it. Treated as an enum, which is what it is.
    assertEquals(isContentField([{ value: "a", label: "a" }]), false);
});

Deno.test("a field with no options at all is not content", () => {
    assertEquals(isContentField(undefined), false);
});

Deno.test("a single and a multiple choice encode as the fields already expect", () => {
    // The selector must not change the stored shape: single is a bare id,
    // multiple is the comma list parseIdList/formatIdList already round-trip.
    const order = ["mdmy.ores", "mdmy.sand"];
    assertEquals(parseIdList(formatIdList(order.slice(0, 2))), order);
    assertEquals(parseIdList(formatIdList([])), []);
});

Deno.test("every content field's options survive the round trip", () => {
    // Guards the wiring: whatever a definition resolves for a content field must
    // still parse through the same codec the selector writes with.
    const form: Record<string, string> = {};
    let checked = 0;
    const total: string[] = [];
    const claimed: string[] = [];

    for (const [tab, def] of Object.entries(DEFINITIONS)) {
        for (const f of def?.fields ?? []) {
            if (f.kind !== "select" && f.kind !== "multiselect") continue;
            const name = `${tab}.${f.key}`;
            total.push(name);
            if (!isContentField(f.options)) continue;
            checked++;
            claimed.push(name);
            const opts = resolveOptions(f, form);
            if (opts.length === 0) continue;
            const values = opts.slice(0, 3).map((x) => x.value);
            if (f.kind === "select") {
                for (const v of values) assertEquals(parseIdList(v)[0] ?? v, v);
            } else {
                assertEquals(parseIdList(formatIdList(values)), values);
            }
        }
    }
    assert(checked > 0, "expected the panel to have content fields to check");
    console.log(`     claimed (${checked}/${total.length}): ${claimed.join(", ")}`);
    const rest = total.filter((n) => !claimed.includes(n));
    console.log(`     NOT claimed (${rest.length}): ${rest.join(", ")}`);
});

// ── The crash this module had once ────────────────────────────────────────────
//
// React #310, "Rendered more hooks than during the previous render". The panel
// builds its form with `sec.fields.map((f) => renderField(f))`, so a control is
// a plain function called during the panel's render — not a component that React
// mounts. A `useState` inside one registers against the *panel's* hook slots, and
// a form's field list changes with the tab and with every field's `when`, so the
// count changes between renders and React throws.
//
// These assert the property that prevents it, on the source rather than on a
// rendered tree: reproducing a crash of this kind needs a live React, and by then
// the error is minified and points at the panel rather than at the culprit.

const HOOK_RE = /\buse(State|Effect|Memo|Ref|Callback|Reducer|Context)\s*\(/g;

/** Source with comments stripped, so a doc explaining the rule does not trip it. */
async function codeOf(rel: string): Promise<string> {
    const src = await Deno.readTextFile(new URL(rel, import.meta.url));
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

Deno.test("the selector calls no hooks, so it cannot desync the panel's", async () => {
    const code = await codeOf("./selector.ts");
    const found = [...code.matchAll(HOOK_RE)].map((m) => m[1]);
    assertEquals(found, [], `selector.ts must stay hook-free, found: ${found.join(", ")}`);
});

Deno.test("no other control renderer calls a hook either", async () => {
    // The same trap and the same rule for every sibling — renderActionList,
    // renderProjectileOption, paramInput are plain functions too.
    for (
        const f of [
            "../../../action-list-control.ts",
            "../../../projectile-option-control.ts",
            "../../../param-controls.ts",
        ]
    ) {
        const code = await codeOf(f);
        const found = [...code.matchAll(HOOK_RE)].map((m) => m[1]);
        assertEquals(found, [], `${f} must stay hook-free, found: ${found.join(", ")}`);
    }
});

Deno.test("selector state is keyed by field and entry, so two pickers differ", () => {
    assert(selectorKey("structureId", "s1") !== selectorKey("structureId", "s2"));
    assert(selectorKey("structureId", "s1") !== selectorKey("itemId", "s1"));
    // A brand-new entry has no id yet and still needs its own key.
    assert(selectorKey("structureId", null) !== selectorKey("itemId", null));
});

// ── Rendering, on a plain-element stand-in ────────────────────────────────────

interface N {
    tag: string;
    props: Record<string, unknown>;
    children: unknown[];
}

/**
 * `h` that builds a record tree, so the output can be walked without a DOM.
 *
 * Typed as the variadic shape `SelectorReact` asks for, and read `tag`/`props`
 * back off the record — so a child that is a plain string (a label) still lands
 * in the tree rather than being dropped, which is what makes the text assertions
 * below mean anything.
 */
const h = (...args: unknown[]): unknown => {
    const [tag, props, ...children] = args as [
        string,
        Record<string, unknown> | null | undefined,
        ...unknown[],
    ];
    return { tag, props: props ?? {}, children: children.flat(Infinity) };
};

/** Every node in a rendered tree, depth first. */
function walk(node: unknown): N[] {
    if (node === null || node === undefined) return [];
    if (typeof node !== "object") return [];
    const n = node as N;
    return [n, ...(n.children ?? []).flatMap((c) => walk(c))];
}

/** Every string leaf in a tree, in order. */
function strings(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (node === null || node === undefined) return [];
    if (typeof node !== "object") return [];
    return (node as N).children.flatMap((c) => strings(c));
}

/** All the text in a tree, joined, for substring assertions. */
function textOf(node: unknown): string {
    return strings(node).join(" ").replace(/\s+/g, " ");
}

const SAMPLE = [
    { value: "mdmy.ores", label: "Red Ore (this mod)", source: "mod" as const, color: "#ff8800" },
    { value: "mdmy.sand", label: "Mod Sand (this mod)", source: "mod" as const },
    { value: "Sand", label: "Sand", source: "game" as const, color: "#d8c07a" },
];

Deno.test("closed by default, showing only the choice", () => {
    const el = renderSelector({
        react: { h },
        value: "mdmy.ores",
        options: SAMPLE,
        multiple: false,
        onState: () => {},
        onChange: () => {},
    });
    const t = textOf(el);
    // Collapsed: the chosen value is there, the menu's chips are not.
    assert(t.includes("Red Ore"), t);
    assert(!t.includes("This mod"), t);
});

Deno.test("open shows the filter chips, and there is no 'This mod' chip", () => {
    const el = renderSelector({
        react: { h },
        value: "",
        options: SAMPLE,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    const t = textOf(el);
    // "This mod" is the state the menu opened in, so it is not a chip — a button
    // that only ever re-selects the default costs a click and says nothing.
    assert(!t.includes("This mod"), t);
    // The two states you have to move *to* are the ones worth a chip.
    assert(t.includes("Game"), t);
    assert(t.includes("All"), t);
    // And what is actually on is said in words rather than by a chip.
    assert(t.includes("showing your 2"), t);
});

Deno.test("each option is a full-width row, not a wrapped chip", () => {
    const el = renderSelector({
        react: { h },
        value: "",
        options: SAMPLE,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    const opt = walk(el).find((n) => n.props?.key === "opt:mdmy.ores");
    const s = opt?.props.style as Record<string, unknown>;
    assertEquals(s?.width, "100%");
    assertEquals(s?.display, "flex");
    assertEquals(s?.textAlign, "left");
});

Deno.test("a row that is not this mod's is tagged with its owner", () => {
    const el = renderSelector({
        react: { h },
        value: "",
        options: [
            { value: "othermod.anvil", label: "Anvil", source: "game" as const },
            { value: "Sand", label: "Sand", source: "game" as const },
        ],
        multiple: false,
        state: { open: true, owner: "all" },
        onState: () => {},
        onChange: () => {},
    });
    const t = textOf(el);
    assert(t.includes("othermod"), t);
    // An unnamespaced id is the game's, and is labelled as such rather than blank.
    assert(t.includes("game"), t);
});

Deno.test("a coloured option carries its swatch into the row", () => {
    const el = renderSelector({
        react: { h },
        value: "",
        options: SAMPLE,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    const sw = walk(el).find((n) =>
        (n.props?.style as Record<string, unknown> | undefined)?.background === "#ff8800"
    );
    assert(sw, "the red ore swatch was not rendered");
});

// ── Hidden objects ────────────────────────────────────────────────────────────

const WITH_HIDDEN = [
    { value: "mdmy.ores", label: "Red Ore", source: "mod" as const },
    { value: "mdmy.secret", label: "Secret Ore", source: "mod" as const, hidden: true },
];

Deno.test("a hidden object is not listed until the box is ticked", () => {
    const off = renderSelector({
        react: { h },
        value: "",
        options: WITH_HIDDEN,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    assert(!textOf(off).includes("Secret Ore"), textOf(off));

    const on = renderSelector({
        react: { h },
        value: "",
        options: WITH_HIDDEN,
        multiple: false,
        state: { open: true, showHidden: true },
        onState: () => {},
        onChange: () => {},
    });
    assert(textOf(on).includes("Secret Ore"), textOf(on));
});

Deno.test("the checkbox is offered only when there is something to reveal", () => {
    // A box that can only ever read "0" is noise on every sprite and key-code
    // field, so it is not rendered at all when nothing is hidden.
    const none = renderSelector({
        react: { h },
        value: "",
        options: SAMPLE,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    assert(!walk(none).some((n) => n.props?.key === "hidden-box"));

    const some = renderSelector({
        react: { h },
        value: "",
        options: WITH_HIDDEN,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: () => {},
    });
    assert(walk(some).some((n) => n.props?.key === "hidden-box"), "no checkbox was offered");
});

Deno.test("the checkbox asks the panel to set showHidden", () => {
    // The panel owns the state — a control that kept its own would be a hook,
    // and a hook here is the React #310 crash.
    let patch: SelectorState | null = null;
    const el = renderSelector({
        react: { h },
        value: "",
        options: WITH_HIDDEN,
        multiple: false,
        state: { open: true },
        onState: (p) => {
            patch = p;
        },
        onChange: () => {},
    });
    const box = walk(el).find((n) => n.props?.type === "checkbox");
    assert(box, "no checkbox input was rendered");
    (box.props.onChange as (e: { target: { checked: boolean } }) => void)({
        target: { checked: true },
    });
    assertEquals(patch, { showHidden: true });
});

Deno.test("a value the catalogue dropped stays visible when the menu is closed", () => {
    // The menu filters orphans out, so they have to be reported outside it or the
    // field looks empty while the entry still holds the reference.
    const el = renderSelector({
        react: { h },
        value: "removedmod.thing",
        options: SAMPLE,
        multiple: false,
        onState: () => {},
        onChange: () => {},
    });
    const t = textOf(el);
    assert(t.includes("removedmod.thing"), t);
    assert(t.includes("no longer exists"), t);
});

Deno.test("clicking an option asks the panel to write the value", () => {
    let written: string | null = null;
    const el = renderSelector({
        react: { h },
        value: "",
        options: SAMPLE,
        multiple: false,
        state: { open: true },
        onState: () => {},
        onChange: (v) => {
            written = v;
        },
    });
    const opt = walk(el).find((n) => n.props?.key === "opt:mdmy.ores");
    assert(opt, "the option for mdmy.ores was not rendered");
    (opt.props.onClick as () => void)();
    assertEquals(written, "mdmy.ores");
});

Deno.test("a multiple selector toggles, and keeps the comma-list encoding", () => {
    let written: string | null = null;
    const el = renderSelector({
        react: { h },
        value: "mdmy.ores",
        options: SAMPLE,
        multiple: true,
        state: { open: true },
        onState: () => {},
        onChange: (v) => {
            written = v;
        },
    });
    const opt = walk(el).find((n) => n.props?.key === "opt:mdmy.sand");
    (opt?.props.onClick as () => void)();
    // Catalogue order, comma separated — the encoding parseIdList already expects.
    assertEquals(written, "mdmy.ores, mdmy.sand");
});
