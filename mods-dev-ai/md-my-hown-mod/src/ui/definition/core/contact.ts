/**
 * The **contact** object definition.
 *
 * A contact reaction is "when element A touches element B, they become C and D".
 * It is the smallest object in the panel — five fields, no widget of its own —
 * and the only thing that makes it more than a form is the `null` on an output.
 *
 * That null is a real value, not a missing one: it means *consume this input*.
 * The engine reads `outputA: null` as "the first reactant is used up and nothing
 * is produced from it", which is how every one-way reaction is expressed. So the
 * form cannot treat an empty picker as "unset" — it has to be able to write a
 * deliberate null, and a deliberate null has to read back as such rather than as
 * an empty control that the author then has to guess about.
 *
 * Ground truth: `doc/doc-tech/08-registering-elements.md` (element + contact).
 */
import { listContactOrientation, listOutputTargets } from "../../../catalog.ts";
import { elSelect, idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

/**
 * A select that can hold three distinct answers, not two.
 *
 *   ""           → leave unset
 *   "__null__"   → an explicit null, which the engine reads as "consume this
 *                  input" — a real reaction outcome, not the absence of one
 *   "__custom__" → the companion *Custom field supplies the value
 *
 * Collapsing the middle case into "" would turn "these two react and the first
 * is consumed" into "these two do not react", which is the one distinction a
 * contact reaction cannot lose.
 */
function optSel(form: Record<string, string>, key: string): string | number | null | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "" || v === "__custom__") return undefined;
    if (v === "__null__") return null;
    return v;
}

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    elSelect("inputA", "Input A", "Reaction", true),
    elSelect("inputB", "Input B", "Reaction", true),
    {
        key: "outputA",
        label: "Output A",
        kind: "select",
        section: "Reaction",
        required: true,
        options: listOutputTargets,
        hint: "what input A becomes (∅ = consumed)",
    },
    {
        key: "outputB",
        label: "Output B",
        kind: "select",
        section: "Reaction",
        required: true,
        options: listOutputTargets,
        hint: "what input B becomes (∅ = consumed)",
    },
    {
        key: "orientation",
        label: "Orientation",
        kind: "select",
        section: "Reaction",
        required: true,
        def: "any",
        options: listContactOrientation,
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole contact. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("inputA", read.str(e.inputA) ?? read.num(e.inputA));
    read.put("inputB", read.str(e.inputB) ?? read.num(e.inputB));
    // A stored `null` becomes the "__null__" sentinel, not an empty control —
    // otherwise the next save would write nothing and the reaction would
    // silently stop consuming its first input.
    read.put(
        "outputA",
        e.outputA === null ? "__null__" : read.str(e.outputA) ?? read.num(e.outputA),
    );
    read.put(
        "outputB",
        e.outputB === null ? "__null__" : read.str(e.outputB) ?? read.num(e.outputB),
    );
    read.put("orientation", read.str(e.orientation));
}

/** Form strings → stored entry, for the whole contact. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("inputA", w.opt("inputA"));
    w.setStr("inputB", w.opt("inputB"));
    // `setRaw`, not `setStr`: the whole point of the sentinel is that this
    // value can be `null`, and a setter that takes a string cannot hold one.
    const oa = optSel(form, "outputA");
    if (oa !== undefined) w.setRaw("outputA", oa);
    const ob = optSel(form, "outputB");
    if (ob !== undefined) w.setRaw("outputB", ob);
    w.setStr("orientation", w.opt("orientation"));
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["inputA", "inputB", "outputA", "outputB", "orientation"];

export const contactDefinition: Definition = {
    tab: "contacts",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every field is a dropdown, and every rule is
    // either a per-field constraint or the `required` on the two outputs. A
    // contact is the clearest case of a definition that is nothing but schema
    // plus a round trip, and that is a real outcome rather than a missing one.
};
