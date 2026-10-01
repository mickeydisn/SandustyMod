
import { listTechIds } from "../../../catalog.ts";
import { advField, idField, NAME_MAX, textField } from "../fields.ts";
import { CUSTOM, parseIdList, parseObjectOrUndefined, putCustomOrSelect } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    idField(),
    {
        
        
        
        
        
        
        key: "name",
        label: "Display name",
        kind: "text",
        section: "Identity",
        maxLength: NAME_MAX,
        hint: "needed unless a name key is set — the engine throws without one",
    },
    textField("nameKey", "Name key (i18n)", "Identity", false, {
        placeholder: "mods|example|category|name",
        maxLength: 120,
    }),
    {
        key: "requirementTechId",
        label: "Requirement (stored only)",
        kind: "select",
        section: "Identity",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add a Tech first — there is nothing to point at.",
        hint:
            "the engine stores this and never reads it, so nothing happens either way. Set it only if you know your build consumes it.",
    },
    {
        key: "requirementJson",
        label: "Requirement (raw)",
        kind: "json",
        section: "Advanced",
        jsonType: "object",
        wide: true,
        when: (f) => f.requirementTechId === CUSTOM,
        hint: "for a shape other than a tech id — stored verbatim, and equally unread",
    },
    advField(),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("nameKey", read.str(e.nameKey));
    
    
    
    
    
    
    
    
    
    const req = e.requirement;
    if (typeof req === "string") {
        putCustomOrSelect(read.put, req, "requirementTechId", "requirementJson", []);
    } else if (req !== undefined) {
        read.put("requirementTechId", CUSTOM);
        read.put("requirementJson", read.json(req));
    }
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("nameKey", w.opt("nameKey"));
    
    const rawReq = parseObjectOrUndefined(form.requirementJson);
    const techReq = w.opt("requirementTechId");
    if (techReq === CUSTOM) {
        if (rawReq) w.setRaw("requirement", rawReq);
    } else if (techReq) {
        w.setStr("requirement", techReq);
    } else if (rawReq) {
        w.setRaw("requirement", rawReq);
    }
}




const FORM_COVERED = ["name", "nameKey", "requirement"];


function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (errors.name || errors.nameKey) return;
    if (!(form.name ?? "").trim() && !(form.nameKey ?? "").trim()) {
        errors.name = "required unless a name key is set";
    }
}

export const upgradeCategoryDefinition: Definition = {
    tab: "categories",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,
    
    
};
