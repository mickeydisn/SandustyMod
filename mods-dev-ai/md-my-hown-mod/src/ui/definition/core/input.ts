
import { listAnyHandlerKeys, listKeyCodes } from "../../../catalog.ts";
import { advField, idField, NAME_MAX, textField, typesHintFor } from "../fields.ts";
import { parseIdList } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";



const FIELDS: FieldSpec[] = [
    idField(),
    
    textField("displayName", "Display name", "Identity", true, { maxLength: NAME_MAX }),
    textField("displayNameKey", "Display name key (i18n)", "Identity", false, {
        placeholder: "mods|example|toggle",
        maxLength: 120,
        hint: "overrides the display name when set",
    }),
    textField("category", "Settings category", "Identity", true, {
        maxLength: NAME_MAX,
        def: "Mod controls",
        hint: "grouping heading in the game's settings screen",
    }),
    {
        
        
        
        key: "subsectionJson",
        label: "Subsection",
        kind: "json",
        section: "Identity",
        jsonType: "object",
        wide: true,
        hint: "optional settings group: { title, titleKey, description, descriptionKey }",
    },
    {
        
        
        
        key: "defaultKeys",
        label: "Default keys",
        kind: "multiselect",
        section: "Binding",
        options: listKeyCodes,
        emptyHint:
            "no suggested keys are available from the host yet; the binding will start unbound.",
        hint: "chords like Control+KeyC are allowed",
    },
    {
        key: "onDownKey",
        label: "Press handler",
        kind: "select",
        section: "Binding",
        options: listAnyHandlerKeys,
        hint: `runs when the key goes down. ${typesHintFor(() => listAnyHandlerKeys())}`,
    },
    {
        key: "onUpKey",
        label: "Release handler",
        kind: "select",
        section: "Binding",
        options: listAnyHandlerKeys,
        hint: `runs when the key comes back up. ${typesHintFor(() => listAnyHandlerKeys())}`,
    },
    advField(),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("displayName", read.str(e.displayName));
    read.put("displayNameKey", read.str(e.displayNameKey));
    read.put("category", read.str(e.category));
    if (Array.isArray(e.defaultKeys)) {
        read.put("defaultKeys", (e.defaultKeys as unknown[]).join(","));
    }
    read.put("onDownKey", read.str(e.onDownKey));
    read.put("onUpKey", read.str(e.onUpKey));
    read.put("subsectionJson", read.json(e.subsection));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("displayName", w.opt("displayName"));
    w.setStr("displayNameKey", w.opt("displayNameKey"));
    w.setStr("category", w.opt("category"));
    
    
    const keys = parseIdList(form.defaultKeys ?? "");
    if (keys.length > 0) w.setRaw("defaultKeys", keys);
    w.setStr("onDownKey", w.opt("onDownKey"));
    w.setStr("onUpKey", w.opt("onUpKey"));
    const subsection = w.optJson<Record<string, unknown>>("subsectionJson");
    if (subsection) w.setRaw("subsection", subsection);
}




const FORM_COVERED = [
    "displayName",
    "displayNameKey",
    "category",
    "defaultKeys",
    "onDownKey",
    "onUpKey",
    "subsection",
];

export const inputDefinition: Definition = {
    tab: "inputs",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
};
