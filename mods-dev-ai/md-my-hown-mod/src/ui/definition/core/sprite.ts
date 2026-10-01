
import { boolField, spriteIdField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    spriteIdField(),
    {
        key: "path",
        label: "Bundled asset",
        kind: "library",
        section: "File",
        required: true,
        wide: true,
        autoKey: "idSuffix",
        placeholder: "search icons by name…",
        hint: "pick a PNG bundled in this mod — the path is filled in for you",
    },
    boolField("fromMod", "Load from mod folder", "File", "true"),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("path", read.str(e.path));
    if (typeof e.fromMod === "boolean") read.put("fromMod", String(e.fromMod));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("path", w.opt("path"));
    w.setBool("fromMod", w.optBool("fromMod"));
}




const FORM_COVERED = ["path", "fromMod"];

export const spriteDefinition: Definition = {
    tab: "sprites",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
    
    
    
    
};
