/**
 * The **tech** object definition.
 *
 * A tech is a research node: a cost, a currency, a branch, a parent, a set of
 * prerequisites, and what completing it unlocks. It is the widest schema left in
 * `schema.ts` and the one with the most decisions that are invisible in the
 * field list.
 *
 * Two of them are worth stating outright, because both are the kind of thing
 * that works until it does not:
 *
 *   - `currencyType` and `branch` are plain strings in `TechDefinition` — there
 *     is no CurrencyType or Branch enum to read. A picker still stops typos
 *     reaching the engine, and `__custom__` keeps every other value legal. The
 *     pair is a contract: a stored value outside the picker's list is moved into
 *     the companion box on read, and the companion box is read on write. Get one
 *     half wrong and the sentinel itself becomes the stored value.
 *
 *   - `unlocks: { structures, items }` is the ONLY route to unlocking a
 *     structure. There is no per-structure "unlockedBy", so writing a tech
 *     without this leaves everything it was meant to grant unreachable.
 *
 * Ground truth: `doc/doc-tech/10-research-and-unlocks.md`.
 */
import {
    listCurrencyTypes,
    listItems,
    listStructures,
    listTechBranches,
    listTechIds,
} from "../../catalog.ts";
import { advField, DESC_MAX, idField, NAME_MAX, numField, textField } from "./fields.ts";
import { formatIdList, parseIdList, putCustomOrSelect } from "./values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** A free string in the engine, so a typed id rather than anything. */
const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,31}$";
const ID_MSG = "lowercase id (a-z 0-9 . _ -)";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    numField("cost", "Cost", "Research", { required: true, min: 0, max: 999999, def: "100" }),
    {
        key: "currencyType",
        label: "Currency",
        kind: "select",
        section: "Research",
        options: listCurrencyTypes,
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
        options: (f) => listTechIds(f.idSuffix),
        hint: "feeds registerNode(techId, def, { parentId }) — grids this node under a parent",
    },
    {
        key: "requires",
        label: "Requires",
        kind: "multiselect",
        section: "Research",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot require itself.",
        hint: "TechDefinition.requires — a node can never require itself",
    },
    textField("description", "Description", "Research", false, {
        maxLength: DESC_MAX,
    }),
    textField("descriptionKey", "Description key (i18n)", "Research", false, {
        placeholder: "mods|example|tech|desc",
        maxLength: 120,
        hint: "used when no plain description is set",
    }),
    {
        // TechDefinition.unlocks = { structures?: string[], items?: string[] }.
        // This is the declarative route — no handler needed. It is also the
        // ONLY route: there is no per-structure "unlockedBy" field.
        key: "unlockStructures",
        label: "Unlocks structures",
        kind: "multiselect",
        section: "Unlocks",
        options: listStructures,
        emptyHint: "add a Structure first — or tick Always unlocked on the structure itself.",
        hint: "researching this node makes these buildable",
    },
    {
        key: "unlockItems",
        label: "Unlocks items",
        kind: "multiselect",
        section: "Unlocks",
        options: listItems,
        emptyHint: "add an Item first — there is nothing this node can grant yet.",
        hint: "items granted when the research completes",
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole tech. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
    read.put("cost", read.num(e.cost));
    // A stored value outside the picker's options (hand-edited JSON, or a config
    // saved before these pickers existed) is moved into the companion custom box
    // so saving cannot silently drop it.
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
    const unlocks = e.unlocks as { structures?: string[]; items?: string[] } | undefined;
    read.put("unlockStructures", read.jsonList(unlocks?.structures));
    read.put("unlockItems", read.jsonList(unlocks?.items));
}

/** Form strings → stored entry, for the whole tech. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
    w.setNum("cost", w.optNum("cost"));
    // "__custom__" on the picker means "use the companion text box".
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
    const requires = parseIdList(form.requires);
    if (requires.length > 0) w.setRaw("requires", requires);
    // TechDefinition.unlocks = { structures?, items? } — declarative, no
    // handler, and the only way a structure becomes unlocked.
    const unlockStructures = parseIdList(form.unlockStructures);
    const unlockItems = parseIdList(form.unlockItems);
    if (unlockStructures.length > 0 || unlockItems.length > 0) {
        const unlocks: Record<string, string[]> = {};
        if (unlockStructures.length > 0) unlocks.structures = unlockStructures;
        if (unlockItems.length > 0) unlocks.items = unlockItems;
        w.setRaw("unlocks", unlocks);
    }
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = [
    "name",
    "description",
    "descriptionKey",
    "cost",
    "currencyType",
    "branch",
    "parentId",
    "requires",
    "unlocks",
];

export const techDefinition: Definition = {
    tab: "techs",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every control is a text box, a number, a
    // dropdown or a multi-select. The `when` gates on `__custom__` are what make
    // the two picker/text pairs work, and they are per-field.
    //
    // `gatesStructures` is deliberately absent and never written: it is derived
    // from each structure's own `unlockNode`, so writing it here would be a
    // second, competing source for the same fact.
};
