/**
 * The `actionList` control: the ordered-process editor.
 *
 * The behaviours pinned here are the ones a plain text box could not offer, and
 * that a user would otherwise only discover by breaking a config: order is
 * meaningful, an unusable action is kept rather than dropped, and the dropdown
 * offers only what this **call site** can run.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { HANDLER_META, handlersForSlot, TAB_TO_CALL_SITE } from "../../hooks/handler-registry.ts";
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
        cfg: {},
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
    assert(!opts.includes("techAppendUnlock"), "an upgrade action is not");
    for (const o of opts.filter((x) => x !== "")) {
        const meta = HANDLER_META.find((m) => m.key === o);
        assert(meta?.slots.includes("processing" as never), `${o} cannot serve processing`);
    }
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
    render("processing", { actionsJson: formatActionRefs([{ key: "processorLog" }]) });
    const selects = nodes.filter((n) => n.tag === "select" && n.props.key === "key");
    assertEquals(selects.length, 1, "the row has its own dropdown");
    const opts = nodes.filter((n) => n.tag === "option").map((o) => o.props.value as string);
    assert(opts.includes("processorLog"));
    assert(!opts.includes("triggerLog"), "a trigger action is not offered to a processor");
});

Deno.test("an action the slot cannot serve is kept and marked, not dropped", () => {
    // The regression this guards: silently deleting a row is how a process loses a
    // step with nobody noticing. It must still be shown, and still be in the JSON.
    //
    // `triggerLog` is a *real* action that `processing` cannot run — it needs a
    // position and a process's first argument is not one. It used to be
    // `projectileHeavy` here, which no longer works as an example: a projectile
    // option is not an action at all, so it would now be an *unknown* key rather
    // than a slot mismatch, and the two failures need different messages.
    render("processing", { actionsJson: formatActionRefs([{ key: "triggerLog" }]) });
    assert(
        nodes.some((n) => n.tag === "option" && n.props.value === "triggerLog"),
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
