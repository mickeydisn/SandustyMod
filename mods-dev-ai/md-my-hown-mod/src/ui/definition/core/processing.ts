import { listStructures } from "../../../catalog.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../../control/process-ref-field.ts";
import { advField, idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "structureType",
        label: "Structure type",
        kind: "select",
        section: "Target",
        required: true,
        options: listStructures,
        hint: "process() runs for every placed instance of this structure type",
    },
    numField("intervalMs", "Interval (ms)", "Timing", {
        required: true,
        min: 16,
        max: 60000,
        def: "1000",
        hint: "must be > 0 — how often the callback fires per instance",
    }),
    {
        ...processRefField("runs on the interval, for every instance of the structure type"),
        section: "Timing",
        required: true,
    },
    advField(),
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("structureType", read.str(e.structureType) ?? read.num(e.structureType));
    read.put("intervalMs", read.num(e.intervalMs));
    readProcessRef(read, e);
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureType", w.opt("structureType"));
    w.setNum("intervalMs", w.optNum("intervalMs"));
    writeProcessRef(w);
}

const FORM_COVERED = ["structureType", "intervalMs", ...PROCESS_COVERED];

export const processingDefinition: Definition = {
    tab: "processing",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
