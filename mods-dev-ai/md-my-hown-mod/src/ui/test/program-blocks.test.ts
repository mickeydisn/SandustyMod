/**
 * The program grid, and specifically the `if` block.
 *
 * Everything here is about one class of bug: **a block is a program, and the grid
 * treated it as a step.** Three failures came from that, and none was caught by
 * the offline suite — because every other test in this repo asserts on the
 * *config*, which was correct, compiled, and completely silent about the panel.
 *
 *   1. `withOptions` rebuilt the step from `key`/`as`/`options`, so typing one
 *      character into a block's `var` field **deleted every step in both branches**.
 *   2. `deriveContext` walked only the top level, so a variable bound inside a
 *      branch was listed as "referenced, never bound" — next to the step that
 *      binds it.
 *   3. The grid never rendered a branch, so a threshold rule looked like an empty
 *      `if` in the one tool an author uses.
 *
 * The first is the dangerous one and it is a **save** bug: the program was fine
 * until someone edited it, then the entire body was gone with no error. That is
 * why the tests drive the grid's own handlers rather than calling the helpers —
 * the bug lived in the path between a keystroke and the JSON.
 */
import { assert, assertEquals } from "jsr:@std/assert";
import { deriveContext, renderProgramGrid, STEPS_JSON_KEY } from "../program-grid-control.ts";
import type { FieldContext } from "../definition/types.ts";

/** A recorded node from the fake `h`. */
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

/** Every node in the recorded tree, depth-first. */
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

/** The label the block's one field is shown with, read from the block itself. */
const BLOCK_VAR_LABEL = BLOCK_META.params[0].label;

/** A block with a real body, nested one `if` deep — the shape that broke. */
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

/**
 * A live view of the grid: the form, and a way to draw it again.
 *
 * The grid re-derives itself from the JSON on every render and holds no React state
 * of its own, so a test has to **re-draw** to see the effect of a click. Holding
 * on to the first tree — which is what the harness did at first — silently asserts
 * against the screen *before* the action, which is how a test ends up passing
 * because the row it checked was never the row it changed.
 */
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
        /** The grid as it stands now. */
        tree: () => {
            nodes = [];
            return renderProgramGrid(ctx);
        },
        steps: (): { key: string; as?: string; then?: unknown[]; else?: unknown[] }[] =>
            form[STEPS_JSON_KEY] ? JSON.parse(form[STEPS_JSON_KEY]) : [],
    };
}

/**
 * Run the grid over a program.
 *
 * Each call is a **different process**, with a fresh id. That is not tidiness: which
 * rows are open is stored per process id, so two renders sharing an id would share
 * that state and the second test would inherit the first one's expanded rows. The
 * first version of this harness did exactly that and reported every summary test as
 * failing on a screen that was showing input boxes.
 */
let processSeq = 0;

function render(program: unknown, scope = "processing") {
    return makeView({
        id: `p${++processSeq}`,
        name: "test",
        scope,
        [STEPS_JSON_KEY]: JSON.stringify(program, null, 2),
    });
}

/**
 * Render, then open every row, then re-render.
 *
 * Rows start **collapsed** — a program is a list of summaries you open one row at a
 * time — so any test that reaches a parameter input has to come through here.
 */
function renderOpen(program: unknown, scope = "processing") {
    const view = render(program, scope);
    click(view.tree(), "Expand all");
    return view;
}

/** The node for the row whose action select reads `action`. */
function rowFor(root: unknown, action: string): Node {
    // The control strip: the div that holds the action `select` **directly**. Its
    // parent is the row card, one level up.
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
    // Then the card: the div that holds that strip directly. A descendant search
    // would return the outermost container — which holds every row, so it matches
    // any action and a field lookup inside it edits the wrong row.
    const card = all(root).find(
        (n) => n.tag === "div" && n.children.includes(controls as unknown),
    );
    assert(card, `the row for "${action}" has no card around its controls`);
    return card;
}

/**
 * Types into a labelled field the way the screen does.
 *
 * The field is found by its **label** and searched across the whole tree, not by
 * position: a row's fields sit one div deeper than its controls, and a positional
 * lookup edits whichever field comes first — the `var` on one render, something
 * else on the next. That is a test which passes for the wrong reason.
 *
 * The two field kinds are not interchangeable either: a **param** is written by
 * `paramInput`, which fires `onChange` reading `e.target.value`, while the **`as`
 * box** is written inline and fires `onInput` reading `e.currentTarget.value`.
 * Calling the wrong one is a silent no-op, so a test that dispatched the wrong
 * event would report "this field does nothing" about a field that works.
 */
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

/**
 * Clicks a button by its label.
 *
 * Every test that edits a parameter has to go through this, because rows start
 * **collapsed**: a program is shown as a list of summaries and opened one row at a
 * time. That is the intended behaviour, so a test that reached an input without
 * expanding would be testing a screen that no longer exists.
 */
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
    // The data-loss bug, driven the way an author drives it: render the grid, then
    // change a field on the `if` row itself.
    const view = renderOpen(PROGRAM);
    const before = JSON.stringify(view.steps());

    // The block's one field is `var`, labelled by `BLOCK_META` — the same label the
    // screen shows, so this test breaks if the field is ever renamed rather than
    // quietly editing something else.
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
    // And the nested block inside `else` survives too, which is the part a
    // top-level-only fix would have missed.
    const nested = block?.else?.[0] as { key: string; then?: unknown[] } | undefined;
    assertEquals(nested?.key, "if", "the nested block was replaced rather than kept");
    assertEquals(nested?.then?.length, 1, "the nested block's own branch was lost");
    assert(
        before !== JSON.stringify(view.steps()),
        "the edit did nothing, so this would pass for the wrong reason",
    );
});

Deno.test("a block keeps its branches when its `as` box is used", () => {
    // A second, separate call site: the `as` input built its replacement inline
    // rather than through the shared helper, so fixing the params alone would have
    // left this one still emptying the block.
    const view = renderOpen(PROGRAM);
    typeInto(rowFor(view.tree(), "if"), "As", "flag");
    const block = view.steps().find((s) => s.key === "if");
    assertEquals(block?.as, "flag", "the as box did not take the name");
    assertEquals(block?.then?.length, 2, "using the as box emptied the then branch");
});

Deno.test("a block's branches are rendered, indented under it", () => {
    // The complaint this file answers: an `if` that looked empty. Counting rows
    // would pass a grid that rendered the block and not its body, so this checks
    // the branches' own labels are in the tree.
    const view = render(PROGRAM);
    const text = all(view.tree())
        .flatMap((n) => n.children)
        .filter((c): c is string => typeof c === "string");
    assert(
        text.some((t) => t.includes("when true")),
        "the then branch is unlabelled, so a block and a plain step look alike",
    );
    assert(text.some((t) => t.includes("false")), "the else branch is unlabelled");
    // Indented rather than flush, which is what makes depth readable at a glance.
    const indented = all(view.tree()).filter(
        (n) => (n.props as { style?: { marginLeft?: number } }).style?.marginLeft === 12,
    );
    assert(indented.length > 0, "no branch list is indented, so nesting is invisible");
});

Deno.test("the derived context sees variables bound inside a branch", () => {
    // The second bug, and the one that made the whole thing look broken: a program
    // whose body is in branches reported an entirely unbound context, listing the
    // very step that binds a name as the reason it is never bound.
    const rows = deriveContext("processing", PROGRAM as never);
    const byName = new Map(rows.map((r) => [r.name, r]));
    assertEquals(byName.get("full")?.writtenBy, 0, "the compare's own binding is missing");
    // `p` is genuinely never bound, so it must still say so — that is the case the
    // list exists for, and it is why the assertion below is scoped to exclude it.
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

// ── The summary view ─────────────────────────────────────────────────────────

/** The text of every `span` on screen, joined — what the author actually reads. */
function textOf(root: unknown): string {
    return all(root)
        .filter((n) => n.tag === "span")
        .map((n) => n.children.filter((c): c is string => typeof c === "string").join(""))
        .join(" | ");
}

Deno.test("a collapsed row shows every value in one line, as text not inputs", () => {
    // The point of the whole mode. It must be a `span` — a read-only input is still
    // a control, and a program made of controls cannot be scanned.
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
    // The failure mode this rule exists for: a summary that prints only what is set
    // makes a field that was never filled look identical to a default.
    const view = render([{ key: "compare", options: { left: "{{p}}" } }]);
    const text = textOf(view.tree());
    assert(text.includes("op —"), `an unset param is not shown at all: ${text}`);
    assert(text.includes("right —"), `an unset param is not shown at all: ${text}`);
});

Deno.test("a summary shows options the action does not declare", () => {
    // A row that has drifted from its schema is exactly what you are looking for in
    // this view, so it is never quietly dropped.
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

    // One row, not the program: editing is the exception, reading is the rule.
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
    // The trap: collapsing a block and hiding its body would be the same bug as never
    // rendering branches at all, just quieter. A collapsed block is one line for the
    // decision and a line for every step inside it.
    const text = textOf(render(PROGRAM).tree());
    assert(text.includes("bufferWrite"), `a branch step is not readable: ${text}`);
    assert(text.includes("buildStructure"), `a branch step is not readable: ${text}`);
});

Deno.test("moving a row from its summary reorders the program", () => {
    // Order and delete have to work without expanding anything, or a program is one
    // that you reorder reluctantly.
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
