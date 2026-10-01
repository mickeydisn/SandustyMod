
import { listStructures } from "../../../catalog.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../process-ref-field.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";


const KINDS = [
    { value: "interactables", label: "interactables — structure click" },
    { value: "targets", label: "targets — signal receiver" },
    { value: "senderType", label: "senderType — signal sender" },
];



const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "kind",
        label: "Kind",
        kind: "select",
        section: "Signal",
        required: true,
        def: "interactables",
        options: KINDS,
    },
    {
        key: "target",
        label: "Target structure",
        kind: "select",
        section: "Signal",
        required: true,
        options: listStructures,
    },
    {
        
        
        ...processRefField("runs when the structure is clicked"),
        section: "Signal",
        required: true,
    },
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("kind", read.str(e.kind));
    read.put("target", read.str(e.target) ?? read.num(e.target));
    readProcessRef(read, e);
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("kind", w.opt("kind"));
    w.setStr("target", w.opt("target"));
    writeProcessRef(w);
}




const FORM_COVERED = ["kind", "target", ...PROCESS_COVERED];

export const signalDefinition: Definition = {
    tab: "signals",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
};
