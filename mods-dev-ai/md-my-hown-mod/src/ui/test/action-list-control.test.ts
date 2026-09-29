/**
 * The `actionList` control: the ordered-process editor.
 *
 * The behaviours pinned here are the ones a plain text box could not offer, and
 * that a user would otherwise only discover by breaking a config: order is
 * meaningful, an unusable action is kept rather than dropped, and the dropdown
 * offers only what this **call site** can run.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DEFAULT_CONFIG } from "../../constants.ts";
import {
    HANDLER_META,
    handlersForSlot,
    TAB_TO_CALL_SITE,
} from "../../handler/core/handler-registry.ts";
import { renderActionList } from "../action-list-control.ts";
import { formatActionRefs, parseActionRefs } from "../definition/actions-field.ts";

interface Node {
    tag: string;
    props: Record<string, unknown>;
    children: unknown[];
}

let nodes: Node[] = [];
const h = (tag: string, props: Record<string, unknown> | null, ...children: unknown[]) => {
    const n: Node = { tag, props: props ?? {}, children };
    nodes.push(n);
    return n;
};

const find = (tag: string, key?: string): Node | undefined =>
    nodes.find((n) => n.tag === tag && (key === undefined || n.props.key === key));
const buttons = () => nodes.filter((n) => n.tag === "button");
const click = (n: Node) => (n.props.onClick as () => void)();
const type = (n: Node, v: string) =>
    (n.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: v } });

/** Render, and return a reader for what was written back to the form. */
function render(tab: string, form: Record<string, string>) {
    nodes = [];
    let written: string | null = null;
    renderActionList({
        h: h as never,
        form,
        cfg: DEFAULT_CONFIG,
        setField: (_k: string, v: string) => {
            written = v;
        },
        field: { key: "actionsJson", label: "Process", kind: "actionList", section: "x" },
        value: form.actionsJson ?? "",
        locked: false,
        tab: tab as never,
    });
    // `null` when nothing was written, so "the control did not touch the form" is
    // distinguishable from "it wrote an empty string" — the second is a real edit
    // and the first is not.
    return () => written;
}

const threeActions = formatActionRefs([
    { key: "processorLog" },
    { key: "processorConvert", options: { to: "Water" } },
    { key: "processorCount" },
]);

Deno.test("an empty process offers a picker of what can be added, and a count", () => {
    const written = render("processing", {});
    assertEquals(written(), null, "nothing written until the author acts");
    const add = find("select", "add");
    assert(add, "there is no add control");
    assertEquals(add?.props.disabled, false, "adding must be possible on an empty list");
    assert(
        nodes.some((n) => String(n.children[0] ?? "").includes("0 actions")),
        "the count is shown",
    );
});

Deno.test("the add list is the whole call site's vocabulary, on an empty process", () => {
    // The reason this is a select rather than a button: with no rows, the per-row
    // dropdowns do not exist, so this is the only place the availability is shown.
    render("processing", {});
    const opts = nodes.filter((n) => n.tag === "option").map((o) => o.props.value as string);
    assert(opts.includes("processorConvert"), "a processing action is offered");
    assert(!opts.includes("projectileHeavy"), "a projectile factory is not");
    // The vocabulary is the **measured** one now — `HANDLER_META.slots` is derived from
    // each action's needs — so an action that only needs a position or a data bag
    // belongs in a signal's list, and an upgrade action that writes instance data is
    // one of them. What must *not* appear is anything the slot cannot serve, which is
    // what the loop below asserts.
    assert(
        opts.includes("processorCount") || opts.includes("signalLog"),
        "a plain action is offered",
    );
    assert(opts.includes("if"), "the if/else block is offered in the same list");
    for (const o of opts.filter((x) => x !== "" && x !== "if")) {
        const meta = HANDLER_META.find((m) => m.key === o);
        assert(meta?.slots.includes("processing" as never), `${o} cannot serve processing`);
    }
});

Deno.test("the if block can be added, is given both branches, and takes a variable", () => {
    // The node was reachable only by hand-editing JSON, which made the whole block
    // feature undiscoverable. This is the path an author actually takes.
    const written = render("processing", {});
    type(find("select", "add")!, "if");
    const parsed = parseActionRefs(written() ?? "");
    assertEquals(parsed.length, 1, "one row was added");
    assertEquals(parsed[0].key, "if");
    // Both branches present and empty: the shape is visible before a step exists, and
    // the JSON says `if` rather than an action that happens to be conditional.
    assertEquals(parsed[0].options?.then, []);
    assertEquals(parsed[0].options?.else, []);
});

Deno.test("a block's branches are edited as their own lists and round-trip", () => {
    // The shape the control writes for a new block: both branches present and empty.
    const written = render("processing", {
        actionsJson: formatActionRefs([{ key: "if", options: { then: [], else: [] } }]),
    });
    const branches = ["add:then", "add:else"].map((k) => find("select", k));
    assert(branches.every(Boolean), "both branches have an add-list");
    // Adding to a branch writes into that branch only, and leaves the row a block.
    type(branches[0]!, "processorLog");
    const parsed = parseActionRefs(written() ?? "");
    assertEquals(parsed[0].key, "if");
    assertEquals(parsed[0].options?.then, [{ key: "processorLog" }]);
    assertEquals(parsed[0].options?.else, [], "the other branch is untouched");
});

Deno.test("turning a block into an action drops the branches it no longer has", () => {
    // Otherwise the author changes a row's action, is told by the compiler that an
    // ordinary action is malformed, and has no idea the dropdown caused it.
    const written = render("processing", {
        actionsJson: formatActionRefs([{
            key: "if",
            options: { then: [{ key: "processorLog" }] },
        }]),
    });
    type(find("select", "key")!, "readElement");
    const parsed = parseActionRefs(written() ?? "");
    assertEquals(parsed[0].key, "readElement");
    assertEquals(parsed[0].options?.then, undefined, "a dead then-list was left behind");
    assertEquals(parsed[0].options?.else, undefined, "a dead else-list was left behind");
});

Deno.test("a signal and an item offer the same cell vocabulary, and neither offers a commit", () => {
    // The regression this derivation exists to prevent: the slots used to be a
    // hand-written column, and a structure click offered 15 actions where the scope
    // model said 77. So the two slots are now asserted *equal* — both are just "a
    // position" — and a commit-writing action is excluded from both.
    //
    // The tab names are the **config** keys, not the slots: `signals` and `items`.
    // An unknown tab makes the control offer the whole catalogue, so a typo here
    // would quietly turn this into a test that asserts nothing.
    const at = (tab: string): string[] => {
        render(tab, {});
        return nodes.filter((n) => n.tag === "option")
            .map((o) => o.props.value as string)
            .filter(Boolean)
            .sort();
    };
    assertEquals(
        at("signals"),
        at("items"),
        "a click and an item use are both 'a position'",
    );
    assert(at("signals").includes("readElement"), "a cell reader is reachable from a click");
    assert(at("signals").includes("if"), "a block is offered in every call site");
    assert(!at("signals").includes("createElement"), "a commit write is not");
    assert(!at("items").includes("logicForEach"), "a batch write is not");
});

Deno.test("choosing from the add list appends exactly that action", () => {
    const written = render("processing", {});
    type(find("select", "add")!, "processorConvert");
    assertEquals(parseActionRefs(written() ?? ""), [{ key: "processorConvert" }]);
});

Deno.test("choosing the placeholder adds nothing", () => {
    const written = render("processing", {});
    type(find("select", "add")!, "");
    assertEquals(written(), null, "the placeholder must not append a row");
});

Deno.test("order is meaningful — the arrows really reorder", () => {
    const written = render("processing", { actionsJson: threeActions });
    click(find("button", "down")!);
    assertEquals(
        parseActionRefs(written() ?? "").map((r) => r.key),
        ["processorConvert", "processorLog", "processorCount"],
    );
});

Deno.test("the last row moves up too — not only the first", () => {
    // Written as its own test because the obvious version of this passes by
    // accident: re-rendering without capturing the *new* reader reads the previous
    // render's value, so a test that only ever moves row one down proves nothing
    // about the arrow on the last row.
    const written = render("processing", { actionsJson: threeActions });
    const ups = buttons().filter((b) => b.props.key === "up");
    click(ups[ups.length - 1]);
    assertEquals(
        parseActionRefs(written() ?? "").map((r) => r.key),
        ["processorLog", "processorCount", "processorConvert"],
    );
});

Deno.test("the first and last rows cannot move past the ends", () => {
    render("processing", { actionsJson: threeActions });
    const ups = buttons().filter((b) => b.props.key === "up");
    const downs = buttons().filter((b) => b.props.key === "down");
    assertEquals(ups[0].props.disabled, true, "the first row cannot go up");
    assertEquals(downs[downs.length - 1].props.disabled, true, "the last cannot go down");
    assertEquals(ups[1].props.disabled, false, "a middle row can go up");
    assertEquals(downs[0].props.disabled, false, "a middle row can go down");
});

Deno.test("removing a row removes exactly that row", () => {
    const written = render("processing", { actionsJson: threeActions });
    click(buttons().filter((b) => b.props.key === "del")[1]);
    assertEquals(
        parseActionRefs(written() ?? "").map((r) => r.key),
        ["processorLog", "processorCount"],
    );
});

Deno.test("a row's own dropdown is also slot-scoped", () => {
    // The *add* list is the whole vocabulary; a row's own dropdown is the same list
    // plus whatever the row already holds, so an action the slot cannot serve stays
    // visible instead of the dropdown silently displaying a different action.
    //
    // Rendered on the `signals` tab, not `processing`: `processing` delivers everything,
    // so a scope difference is invisible there. On a signal, a commit-writing action is
    // the thing that must be absent.
    render("signals", { actionsJson: formatActionRefs([{ key: "processorLog" }]) });
    const selects = nodes.filter((n) => n.tag === "select" && n.props.key === "key");
    assertEquals(selects.length, 1, "the row has its own dropdown");
    const opts = nodes.filter((n) => n.tag === "option").map((o) => o.props.value as string);
    assert(opts.includes("processorLog"));
    assert(opts.includes("readElement"), "a cell reader is available from a click");
    assert(!opts.includes("createElement"), "a commit-writing action is not offered here");
});

Deno.test("an action the slot cannot serve is kept and marked, not dropped", () => {
    // The regression this guards: silently deleting a row is how a process loses a
    // step with nobody noticing. It must still be shown, and still be in the JSON.
    //
    // `createElement` is a *real* action that `processing` can run and a signal
    // cannot: it writes through `api.grid.mutate`, whose batch reads the staged writes
    // through the processing context, so only `process()` supplies it. It used to be
    // `triggerLog` here, which stopped being an example the moment the slots became
    // measured — a logger needs nothing, so it is offered everywhere.
    render("signals", { actionsJson: formatActionRefs([{ key: "createElement" }]) });
    assert(
        nodes.some((n) => n.tag === "option" && n.props.value === "createElement"),
        "the unusable action is not shown at all",
    );
    // `style` is an object, so this has to read the property — `String(style)`
    // would be "[object Object]" and match nothing.
    assert(
        nodes.some((n) =>
            String((n.props.style as { border?: string })?.border).includes("7a3030")
        ),
        "an unusable row is not outlined",
    );
    // …and a row the slot *can* serve is not outlined, or the red would be noise.
    render("signals", { actionsJson: formatActionRefs([{ key: "processorLog" }]) });
    assert(
        !nodes.some((n) =>
            String((n.props.style as { border?: string })?.border).includes("7a3030")
        ),
        "a usable row in this slot must not be outlined",
    );
});

Deno.test("the same action twice keeps both rows and their different options", () => {
    const written = render("processing", {
        actionsJson: formatActionRefs([
            { key: "processorConvert", options: { to: "Water" } },
            { key: "processorConvert", options: { to: "Lava" } },
        ]),
    });
    assertEquals(buttons().filter((b) => b.props.key === "del").length, 2, "both rows exist");
    // Removing the first leaves the second's options alone.
    click(buttons().filter((b) => b.props.key === "del")[0]);
    assertEquals(parseActionRefs(written() ?? ""), [
        { key: "processorConvert", options: { to: "Lava" } },
    ]);
});

Deno.test("the widget and the validator agree about what a slot is", () => {
    // The widget filters its dropdown with `TAB_TO_CALL_SITE`, and the validator
    // checks the stored list with the same table. If those two ever disagreed, the
    // picker would offer an action the save then rejected — the worst combination,
    // because it looks like the panel is broken rather than the config.
    for (const [tab, slot] of Object.entries(TAB_TO_CALL_SITE)) {
        assert(
            handlersForSlot(slot as never).length > 0,
            `${tab} maps to ${slot}, which no action can serve`,
        );
    }
    // Every tab that stores a process is in the table, and the table has no extras.
    //
    // `projectiles` used to be the seventh. It is not a process tab any more: a
    // projectile holds one `ProjectileOption`, edited by a different control
    // (`projectileOption`), so it has no call site to map to. Its absence here is
    // what stops the action list offering a row for a slot that cannot serve one.
    assertEquals(
        Object.keys(TAB_TO_CALL_SITE).sort(),
        ["items", "modifiers", "processing", "signals", "triggers", "upgrades"],
        "the table and the tabs that store a process disagree",
    );
});
