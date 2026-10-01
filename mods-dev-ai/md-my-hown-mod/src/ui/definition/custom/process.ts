
import { advField, idField, textField } from "../fields.ts";
import { HANDLER_SLOT_LABELS, type HandlerSlot } from "../../../handler/core/handler-registry.ts";
import { CALL_SITE_LABELS, CALL_SITE_SIGNATURES } from "../../../handler/core/types.ts";
import { renderProgramGrid, STEPS_FORM_KEY } from "../../program-grid-control.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";




const SCOPES = Object.keys(HANDLER_SLOT_LABELS) as HandlerSlot[];


function scopeOptions(): { value: string; label: string }[] {
    return SCOPES.map((slot) => ({
        value: slot,
        
        
        label: `${CALL_SITE_LABELS[slot]} — ${CALL_SITE_SIGNATURES[slot]}`,
    }));
}

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Display name", "Identity", false, {
        hint: "shown in every picker that offers this process",
    }),
    {
        key: "scope",
        label: "Scope",
        kind: "select",
        section: "Identity",
        required: true,
        options: scopeOptions,
        hint: "which call site this process is for. It decides what the process can " +
            "name — a trigger is handed nothing, a processor gets the structure and " +
            "the cell context — and a process may only be used in the slot it is built for.",
    },
    textField("doc", "Description", "Identity", false, {
        maxLength: 200,
        hint: "one line on what it does",
    }),
    {
        
        
        key: STEPS_FORM_KEY,
        label: "Program",
        kind: "program",
        section: "Program",
        wide: true,
    },
    {
        
        
        
        key: `${STEPS_FORM_KEY}__json`,
        label: "Steps",
        kind: "json",
        section: "Program",
        jsonType: "array",
        when: () => false,
    },
    advField(),
];


function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("scope", read.str(e.scope));
    read.put("doc", read.str(e.doc));
    read.put(
        `${STEPS_FORM_KEY}__json`,
        Array.isArray(e.steps) ? JSON.stringify(e.steps, null, 2) : "",
    );
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    void form;
    w.setStr("name", w.opt("name"));
    const scope = w.opt("scope");
    
    
    if (SCOPES.includes(scope as HandlerSlot)) w.setRaw("scope", scope);
    w.setStr("doc", w.opt("doc"));
    const steps = w.optJson<unknown[]>(`${STEPS_FORM_KEY}__json`);
    if (steps && steps.length > 0) w.setRaw("steps", steps);
    else w.del("steps");
}


const FORM_COVERED = ["name", "scope", "doc", "steps"];

function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind === "program") return renderProgramGrid(ctx);
    return null;
}

export const customProcessDefinition: Definition = {
    tab: "customProcess",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    panel: { renderField },
    
    
    list: { discover: () => [] },
};
