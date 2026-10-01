
import { assert, assertEquals } from "jsr:@std/assert";
import { deriveContext, renderProgramGrid, STEPS_JSON_KEY } from "../program-grid-control.ts";
import type { FieldContext } from "../definition/types.ts";


interface Node {
    tag: string;
    props: Record<string, unknown>;
    children: unknown[];
}

let nodes: Node[] = [];

function h(tag: string, props: Record<string, unknown> | null, ...children: unknown[]) {
    const node: Node = { tag, props: props ?? {}, children };
    nodes.push(node);
    return node;
}


function all(root: unknown): Node[] {
    const out: Node[] = [];
    const walk = (n: unknown) => {
        if (!n || typeof n !== "object" || !("tag" in n)) return;
        const node = n as Node;
        out.push(node);
        for (const c of node.children) walk(c);
    };
    walk(root);
    return out;
}

import { BLOCK_META } from "../../handler/core/handler-registry.ts";


const BLOCK_VAR_LABEL = BLOCK_META.params[0].label;


const PROGRAM = [
    { key: "compare", options: { left: "{{p}}", op: "gte", right: "50" }, as: "full" },
    {
        key: "if",
        options: { var: "full" },
        then: [
            { key: "bufferWrite", options: { path: "progress", value: "0" } },
            { key: "buildStructure", options: { structure: "artefact", dx: "5" } },
        ],
        else: [
            {
                key: "if",
                options: { var: "other" },
                then: [{ key: "bufferIncrement", options: { path: "progress", delta: "1" } }],
            },
        ],
    },
];


function makeView(form: Record<string, string>) {
    const ctx = {
        h,
        form,
        setField: (k: string, v: string) => {
            form[k] = v;
        },
        error: "",
        locked: false,
    } as unknown as FieldContext;
    return {
        form,
        
        tree: () => {
            nodes = [];
            return renderProgramGrid(ctx);
        },
        steps: (): { key: string; as?: string; then?: unknown[]; else?: unknown[] }[] =>
            form[STEPS_JSON_KEY] ? JSON.parse(form[STEPS_JSON_KEY]) : [],
    };
}


let processSeq = 0;

function render(program: unknown, scope = "processing") {
    return makeView({
        id: `p${++processSeq}`,
        name: "test",
        scope,
        [STEPS_JSON_KEY]: JSON.stringify(program, null, 2),
    });
}


function renderOpen(program: unknown, scope = "processing") {
    const view = render(program, scope);
    click(view.tree(), "Expand all");
    return view;
}


function rowFor(root: unknown, action: string): Node {
    
    
    const controls = all(root).find(
        (n) =>
            n.tag === "div" &&
            n.children.some(
                (c) =>
                    c &&
                    typeof c === "object" && "tag" in c &&
                    (c as Node).tag === "select" &&
                    (c as Node).props.value === action,
            ),
    );
    assert(controls, `the grid rendered no row for "${action}"`);
    
    
    
    const card = all(root).find(
        (n) => n.tag === "div" && n.children.includes(controls as unknown),
    );
    assert(card, `the row for "${action}" has no card around its controls`);
    return card;
}


function typeInto(root: unknown, label: string, value: string): void {
    const box = all(root).find((n) => {
        if (n.tag !== "div") return false;
        const hasLabel = n.children.some(
            (c) =>
                c &&
                typeof c === "object" && "tag" in c && (c as Node).tag === "span" &&
                (c as Node).children[0] === label,
        );
        return hasLabel && all(n).some((c) => c.tag === "input");
    });
    if (!box) throw new Error(`the grid shows no field labelled "${label}"`);
    const input = all(box).find((c) => c.tag === "input") as Node;
    const p = input.props as Record<string, (e: unknown) => void>;
    if (typeof p.onChange === "function") p.onChange({ target: { value } });
    else if (typeof p.onInput === "function") p.onInput({ currentTarget: { value } });
    else throw new Error(`the field "${label}" has no handler to drive`);
}


function click(root: unknown, label: string): void {
    const button = all(root).find(
        (n) =>
            n.tag === "button" &&
            n.children.some((c) => typeof c === "string" && c.includes(label)),
    );
    if (!button) throw new Error(`there is no "${label}" button on screen`);
    (button.props as { onClick: () => void }).onClick();
}

Deno.test("a block keeps both branches when a parameter of its own is edited", () => {
    
    
    const view = renderOpen(PROGRAM);
    const before = JSON.stringify(view.steps());

    
    
    
    typeInto(rowFor(view.tree(), "if"), BLOCK_VAR_LABEL, "renamed");

    const block = view.steps().find((s) => s.key === "if");
    assertEquals(
        (block as { options?: { var?: string } })?.options?.var,
        "renamed",
        "the field the screen shows did not write the option it is bound to",
    );
    assertEquals(
        block?.then?.length,
        2,
        "editing the block's own field deleted the steps in its then branch",
    );
    assertEquals(
        block?.else?.length,
        1,
        "editing the block's own field deleted the steps in its else branch",
    );
    
    
    const nested = block?.else?.[0] as { key: string; then?: unknown[] } | undefined;
    assertEquals(nested?.key, "if", "the nested block was replaced rather than kept");
    assertEquals(nested?.then?.length, 1, "the nested block's own branch was lost");
    assert(
        before !== JSON.stringify(view.steps()),
        "the edit did nothing, so this would pass for the wrong reason",
    );
});

Deno.test("a block keeps its branches when its `as` box is used", () => {
    
    
    
    const view = renderOpen(PROGRAM);
    typeInto(rowFor(view.tree(), "if"), "As", "flag");
    const block = view.steps().find((s) => s.key === "if");
    assertEquals(block?.as, "flag", "the as box did not take the name");
    assertEquals(block?.then?.length, 2, "using the as box emptied the then branch");
});

Deno.test("a block's branches are rendered, indented under it", () => {
    
    
    
    const view = render(PROGRAM);
    const text = all(view.tree())
        .flatMap((n) => n.children)
        .filter((c): c is string => typeof c === "string");
    assert(
        text.some((t) => t.includes("when true")),
        "the then branch is unlabelled, so a block and a plain step look alike",
    );
    assert(text.some((t) => t.includes("false")), "the else branch is unlabelled");
    
    const indented = all(view.tree()).filter(
        (n) => (n.props as { style?: { marginLeft?: number } }).style?.marginLeft === 12,
    );
    assert(indented.length > 0, "no branch list is indented, so nesting is invisible");
});

Deno.test("the derived context sees variables bound inside a branch", () => {
    
    
    
    const rows = deriveContext("processing", PROGRAM as never);
    const byName = new Map(rows.map((r) => [r.name, r]));
    assertEquals(byName.get("full")?.writtenBy, 0, "the compare's own binding is missing");
    
    
    assert(
        String(byName.get("p")?.from).includes("never bound"),
        "a name nothing binds should still be reported as unbound",
    );
    for (const row of rows) {
        if (row.name === "p") continue;
        assert(
            !String(row.from).includes("never bound"),
            `${row.name} is reported as never bound, so it is bound inside a branch ` +
                "and the context list did not descend",
        );
    }
});

Deno.test("deriveContext numbers steps in program order, branches included", () => {
    const rows = deriveContext("processing", [
        { key: "bufferRead", options: { path: "a" }, as: "one" },
        {
            key: "if",
            options: { var: "one" },
            then: [{ key: "bufferRead", options: { path: "b" }, as: "two" }],
        },
    ] as never);
    const byName = new Map(rows.map((r) => [r.name, r]));
    assertEquals(byName.get("one")?.writtenBy, 0);
    assertEquals(byName.get("two")?.writtenBy, 2, "a branch step is numbered out of order");
});




function textOf(root: unknown): string {
    return all(root)
        .filter((n) => n.tag === "span")
        .map((n) => n.children.filter((c): c is string => typeof c === "string").join(""))
        .join(" | ");
}

Deno.test("a collapsed row shows every value in one line, as text not inputs", () => {
    
    
    const view = render([
        { key: "compare", options: { left: "{{p}}", op: "gte", right: "50" }, as: "full" },
    ]);
    const tree = view.tree();
    const text = textOf(tree);
    for (const part of ["compare", "left: {{p}}", "op: gte", "right: 50", "→ full"]) {
        assert(text.includes(part), `the summary omits ${part} — it reads: ${text}`);
    }
    assertEquals(
        all(tree).filter((n) => n.tag === "input").length,
        0,
        "a collapsed row still rendered inputs, so it is still a form, not a summary",
    );
});

Deno.test("a summary shows an unset param rather than hiding it", () => {
    
    
    const view = render([{ key: "compare", options: { left: "{{p}}" } }]);
    const text = textOf(view.tree());
    assert(text.includes("op —"), `an unset param is not shown at all: ${text}`);
    assert(text.includes("right —"), `an unset param is not shown at all: ${text}`);
});

Deno.test("a summary shows options the action does not declare", () => {
    
    
    const view = render([
        { key: "compare", options: { left: "a", typo_param: "kept" }, as: "x" },
    ]);
    assert(
        textOf(view.tree()).includes("typo_param: kept"),
        "an undeclared option is hidden, so a drifted row looks clean",
    );
});

Deno.test("Edit opens one row and Collapse all closes them", () => {
    const view = render(PROGRAM);
    const before = all(view.tree()).filter((n) => n.tag === "input").length;
    assertEquals(before, 0, "the grid started expanded, so nothing was collapsed");

    
    const firstEdit = all(view.tree()).find(
        (n) => n.tag === "button" && n.children.includes("Edit"),
    );
    assert(firstEdit, "no row offered an Edit button");
    (firstEdit.props as { onClick: () => void }).onClick();
    const after = all(view.tree()).filter((n) => n.tag === "input").length;
    assert(after > before, "Edit did not open the row");

    click(view.tree(), "Collapse all");
    assertEquals(
        all(view.tree()).filter((n) => n.tag === "input").length,
        0,
        "Collapse all left rows open",
    );
});

Deno.test("a collapsed block still shows its branches", () => {
    
    
    
    const text = textOf(render(PROGRAM).tree());
    assert(text.includes("bufferWrite"), `a branch step is not readable: ${text}`);
    assert(text.includes("buildStructure"), `a branch step is not readable: ${text}`);
});

Deno.test("moving a row from its summary reorders the program", () => {
    
    
    const view = render([
        { key: "noop", as: "first" },
        { key: "noop", as: "second" },
    ]);
    const down = all(view.tree())
        .filter((n) => n.tag === "button" && n.children.includes("↓"))
        .find((n) => !(n.props as { disabled?: boolean }).disabled);
    assert(down, "no enabled Move down button on a collapsed row");
    (down.props as { onClick: () => void }).onClick();
    assertEquals(
        view.steps().map((s) => s.as),
        ["second", "first"],
        "the summary's move button did not reorder the program",
    );
});
