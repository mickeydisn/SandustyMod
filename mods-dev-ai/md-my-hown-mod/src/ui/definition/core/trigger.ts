
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../../control/process-ref-field.ts";
import { idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    idField(),
    numField("interval", "Interval (ticks)", "Timing", {
        required: true,
        min: 1,
        max: 100000,
        def: "60",
    }),
    numField("sequentialRuns", "Runs per fire", "Timing", { min: 1, max: 1000, def: "1" }),
    {
        
        
        ...processRefField("runs on the interval"),
        section: "Timing",
        required: true,
    },
    {
        key: "extraJson",
        label: "Extra payload",
        kind: "json",
        section: "Timing",
        jsonType: "object",
        wide: true,
        placeholder: "{ }",
    },
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("interval", read.num(e.interval));
    read.put("sequentialRuns", read.num(e.sequentialRuns));
    readProcessRef(read, e);
    read.put("extraJson", read.json(e.extra));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setNum("interval", w.optNum("interval"));
    w.setNum("sequentialRuns", w.optNum("sequentialRuns"));
    writeProcessRef(w);
    const extra = w.optJson<Record<string, unknown>>("extraJson");
    if (extra) w.setRaw("extra", extra);
    
    
    
}



export const triggerDefinition: Definition = {
    tab: "triggers",
    fields: FIELDS,
    
    
    
    
    
    
    
    
    
    
    
    formCovered: ["interval", "sequentialRuns", "extra", ...PROCESS_COVERED],
    entryToForm,
    formToEntry,
};
