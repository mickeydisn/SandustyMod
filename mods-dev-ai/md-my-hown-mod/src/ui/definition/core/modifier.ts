
import { listHookIds } from "../../../catalog.ts";
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../process-ref-field.ts";
import { HOOK_KIND_OPTS } from "../choices.ts";
import { boolField, idField, textField } from "../fields.ts";
import { putCustomOrSelect } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "hookId",
        label: "Engine hook",
        kind: "select",
        section: "Hook",
        required: true,
        options: listHookIds,
        hint: "documented hooks only — see doc-tech/03",
    },
    textField("hookCustom", "Custom hook id", "Hook", true, {
        when: (f) => f.hookId === "__custom__",
        pattern: "^[a-z][a-z0-9]*(:[a-zA-Z0-9]+)+$",
        patternMsg: "e.g. element:update",
    }),
    {
        key: "kind",
        label: "Mode",
        kind: "select",
        section: "Hook",
        required: true,
        def: "intercept",
        options: HOOK_KIND_OPTS,
    },
    {
        
        
        
        ...processRefField("intercepts or rewrites the engine hook", { section: "Hook" }),
        required: true,
    },
    boolField("enabled", "Enabled", "Hook", "true"),
    textField("notes", "Notes", "Hook", false, { maxLength: 120 }),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    
    putCustomOrSelect(read.put, read.str(e.hookId), "hookId", "hookCustom", listHookIds());
    read.put("kind", read.str(e.kind));
    readProcessRef(read, e);
    read.put("notes", read.str(e.notes));
    if (typeof e.enabled === "boolean") read.put("enabled", String(e.enabled));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    
    
    
    w.setStr("hookId", w.opt("hookCustom") ?? w.opt("hookId"));
    w.setStr("kind", w.opt("kind"));
    writeProcessRef(w);
    w.setStr("notes", w.opt("notes"));
    w.setBool("enabled", w.optBool("enabled"));
}




const FORM_COVERED = ["hookId", "kind", "enabled", "notes", ...PROCESS_COVERED];

export const modifierDefinition: Definition = {
    tab: "modifiers",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
};
