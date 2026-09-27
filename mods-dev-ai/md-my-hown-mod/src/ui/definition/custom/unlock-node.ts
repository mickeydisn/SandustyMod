/**
 * The **unlock node** object definition.
 *
 * The widest tab left, and the only one where the *form* has a field the engine
 * does not. A node is either always available or a real research step, and a
 * research step can either build its own tech or borrow one already in the
 * tree. That is a two-stage decision, and it drives every `when` in the schema:
 * nothing about cost, currency, branch, parent or prerequisites is meaningful
 * until `kind` is "tech", and none of it is meaningful if the tech is borrowed.
 *
 * Two rules are load-bearing and invisible in the field list:
 *
 *   - The borrow is exclusive. A borrowed engine tech keeps its own definition,
 *     so a cost typed beside it would be a second source for the same node.
 *     The read side therefore does not read those fields at all for a borrowed
 *     node — showing a value the save path is about to discard is worse than
 *     showing nothing.
 *
 *   - `gatesStructures` is derived from each structure's own `unlockNode`. It
 *     is declared so the graph can show what a node holds back, and it is never
 *     written: two sources for one fact is how a node ends up in a graph that
 *     disagrees with the game.
 *
 * Ground truth: `doc/doc-tech/10-research-and-unlocks.md`.
 */
import { listCurrencyTypes, listStructures, listTechBranches, listTechIds } from "../../catalog.ts";
import { advField, DESC_MAX, idField, NAME_MAX, numField, textField } from "./fields.ts";
import { parseIdList, putCustomOrSelect } from "./values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

/** A free string in the engine, so a typed id rather than anything. */
const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,31}$";
const ID_MSG = "lowercase id (a-z 0-9 . _ -)";

/** True for a node that *builds* a tech: kind is tech, and it is not borrowed. */
const buildsTech = (f: Record<string, string>) => f.kind === "tech" && f.useExistingTech !== "true";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    {
        // Ours, not the engine's. "always" stays mod-owned and needs no
        // research; "tech" builds a real in-game tech node at apply time.
        key: "kind",
        label: "Kind",
        kind: "select",
        section: "Identity",
        required: true,
        def: "always",
        options: [
            { value: "always", label: "always — available from the start" },
            {
                value: "tech",
                label: "tech — a real research step in the game's tech tree",
            },
        ],
        hint: "a tech node is a real research step in the game's tech tree",
    },
    {
        // The borrow is exclusive: an engine tech keeps its own definition,
        // so a cost typed alongside it would be a second source for the same
        // node. Rendered as a toggle because that is the decision being made
        // — build a node, or use one that is already in the tree.
        key: "useExistingTech",
        label: "Reuse an engine tech",
        kind: "bool",
        section: "Node",
        def: "false",
        hint: "off: this node builds its own tech. on: it borrows one already in the tree.",
    },
    {
        key: "techId",
        label: "Engine tech to reuse",
        kind: "select",
        section: "Node",
        when: (f) => f.kind === "tech" && f.useExistingTech === "true",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add a Tech first — there is nothing to borrow.",
        hint: "several nodes can sit behind the same research step",
    },
    numField("cost", "Cost", "Research", {
        min: 0,
        max: 999999,
        def: "100",
        when: buildsTech,
    }),
    {
        key: "currencyType",
        label: "Currency",
        kind: "select",
        section: "Research",
        options: listCurrencyTypes,
        when: buildsTech,
        hint: "TechDefinition.currencyType — a free string in the engine",
    },
    {
        key: "currencyTypeCustom",
        label: "Currency id",
        kind: "text",
        section: "Research",
        when: (f) => f.currencyType === "__custom__",
        placeholder: "coins",
        maxLength: 32,
        pattern: ID_PATTERN,
        patternMsg: ID_MSG,
    },
    {
        key: "branch",
        label: "Branch",
        kind: "select",
        section: "Research",
        options: listTechBranches,
        when: buildsTech,
        hint: "TechDefinition.branch — usually copied from the parent node",
    },
    {
        key: "branchCustom",
        label: "Branch id",
        kind: "text",
        section: "Research",
        when: (f) => f.branch === "__custom__",
        placeholder: "industry",
        maxLength: 32,
        pattern: ID_PATTERN,
        patternMsg: ID_MSG,
    },
    {
        key: "parentId",
        label: "Parent node",
        kind: "select",
        section: "Research",
        when: buildsTech,
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot be its own parent.",
        hint: "without one the tech is never placed in the grid and cannot be bought",
    },
    {
        key: "requires",
        label: "Requires",
        kind: "multiselect",
        section: "Research",
        when: buildsTech,
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot require itself.",
        hint: "other research that must be done first",
    },
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    {
        // Read-only in the form's terms: the link lives on each structure, and
        // this is the reverse view of it. Declared so the graph can show what a
        // node holds back — see the `gatesStructures` row in relations.ts.
        key: "gatesStructures",
        label: "Structures it unlocks",
        kind: "multiselect",
        section: "Identity",
        options: listStructures,
        emptyHint: "no structure points at this node yet.",
        hint:
            "derived — set it on each structure, not here. Shown so you can see what rides on this node.",
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole unlock node. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("kind", read.str(e.kind));
    // `useExistingTech` is a form-only toggle: a node either names the
    // engine tech it borrows or does not, so the presence of `techId` is
    // the whole decision. Round-tripping it explicitly would let the
    // toggle and the id disagree.
    const techId = read.str(e.techId);
    if (techId) {
        read.put("useExistingTech", "true");
        read.put("techId", techId);
    } else {
        read.put("useExistingTech", "false");
    }
    // The rest only belong to a node that *builds* a tech. A borrowed one
    // keeps the engine's definition, so reading them would show fields
    // the save path is about to ignore.
    if (read.str(e.kind) === "tech" && !techId) {
        read.put("cost", read.num(e.cost));
        // A value outside the picker's list moves into the companion box so
        // saving cannot silently drop it.
        putCustomOrSelect(
            read.put,
            read.str(e.currencyType),
            "currencyType",
            "currencyTypeCustom",
            listCurrencyTypes(),
        );
        putCustomOrSelect(
            read.put,
            read.str(e.branch),
            "branch",
            "branchCustom",
            listTechBranches(),
        );
        read.put("parentId", read.str(e.parentId));
        read.put("requires", read.jsonList(e.requires));
    }
    // `gatesStructures` is derived from each structure's own `unlockNode`, so it
    // is never written from here.
}

/** Form strings → stored entry, for the whole unlock node. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("kind", w.opt("kind"));
    // The two modes write disjoint sets of fields, and a field read by
    // one but not written back is silent data loss. An "always" node
    // writes no research fields at all, so a stale cost from a previous
    // edit cannot survive as a second, competing source for how the
    // structure becomes available.
    //
    // Note the `kind === "tech"` guard on the *borrowing* branch too, not just
    // the building one: the toggle is only rendered for a tech node, so a form
    // can hold `useExistingTech: "true"` on an "always" node, and writing
    // `techId` there would attach a research step to a node that is supposed to
    // need none.
    const borrowing = w.opt("kind") === "tech" && w.optBool("useExistingTech") === true;
    if (borrowing) {
        w.setStr("techId", w.opt("techId"));
    } else if (w.opt("kind") === "tech") {
        w.setNum("cost", w.optNum("cost"));
        w.setStr(
            "currencyType",
            w.opt("currencyType") === "__custom__"
                ? w.opt("currencyTypeCustom")
                : w.opt("currencyType"),
        );
        w.setStr(
            "branch",
            w.opt("branch") === "__custom__" ? w.opt("branchCustom") : w.opt("branch"),
        );
        w.setStr("parentId", w.opt("parentId"));
        const requires = parseIdList(form.requires ?? "");
        if (requires.length > 0) w.setRaw("requires", requires);
    }
    // `gatesStructures` is derived from each structure's own `unlockNode`, so it
    // is never written from here.
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = [
    "name",
    "description",
    "kind",
    "techId",
    "cost",
    "currencyType",
    "branch",
    "parentId",
    "requires",
];

export const unlockNodeDefinition: Definition = {
    tab: "unlockNodes",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every conditional is a `when`, and the two
    // picker/text pairs use the shared `putCustomOrSelect` contract.
    //
    // `gatesStructures` is deliberately absent from `formCovered` too: it is a
    // stored key the form must neither claim nor write, so leaving it out lets
    // it fall through as a passthrough if a stored entry ever carries one.
};
