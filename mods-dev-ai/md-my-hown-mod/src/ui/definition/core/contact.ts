import { listContactOrientation, listOutputTargets } from "../../../catalog.ts";
import { elSelect, idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

function optSel(form: Record<string, string>, key: string): string | number | null | undefined {
    const v = (form[key] ?? "").trim();
    if (v === "" || v === "__custom__") return undefined;
    if (v === "__null__") return null;
    return v;
}

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

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("inputA", read.str(e.inputA) ?? read.num(e.inputA));
    read.put("inputB", read.str(e.inputB) ?? read.num(e.inputB));

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

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("inputA", w.opt("inputA"));
    w.setStr("inputB", w.opt("inputB"));

    const oa = optSel(form, "outputA");
    if (oa !== undefined) w.setRaw("outputA", oa);
    const ob = optSel(form, "outputB");
    if (ob !== undefined) w.setRaw("outputB", ob);
    w.setStr("orientation", w.opt("orientation"));
}

const FORM_COVERED = ["inputA", "inputB", "outputA", "outputB", "orientation"];

export const contactDefinition: Definition = {
    tab: "contacts",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
