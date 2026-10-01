
import { advField, DESC_MAX, idField, textField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Display name", "Identity", false, {
        maxLength: DESC_MAX,
        hint: "optional — shown in this list; the engine only ever sees the id",
    }),
    advField(),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    
    
    w.setStr("name", w.opt("name"));
}



export const networkDefinition: Definition = {
    tab: "networks",
    fields: FIELDS,
    formCovered: ["name"],
    entryToForm,
    formToEntry,
    
    
    
};
