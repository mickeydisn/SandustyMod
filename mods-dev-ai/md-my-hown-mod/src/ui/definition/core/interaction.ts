
import { listItems, listStructures } from "../../../catalog.ts";
import {
    composeInteraction,
    DATA_FIELD_MODES,
    INTERACTION_KINDS,
    splitInteraction,
    TOOLTIP_KINDS,
} from "../../interaction.ts";
import { elSelect, idField, numField, textField } from "../fields.ts";
import { parseObjectOrUndefined } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";


const hasTooltip = (f: Record<string, string>) =>
    TOOLTIP_KINDS.includes(f.interactionKind as never);


const comparesField = (f: Record<string, string>) =>
    hasTooltip(f) &&
    (f.tipVisibility === "visibleWhen" || f.tipVisibility === "crossedOutWhen");



const FIELDS: FieldSpec[] = [
    idField(),
    elSelect("elementId", "Element", "Target", true),
    
    
    
    {
        key: "interactionKind",
        label: "What kind of interaction",
        kind: "select",
        section: "What it does",
        required: true,
        options: INTERACTION_KINDS.map((k) => ({ value: k.kind, label: k.label })),
        hint: "this is the tooltip shown when you hold a tool over this element",
    },
    {
        key: "structures",
        label: "Structures",
        kind: "multiselect",
        section: "What it does",
        options: listStructures,
        emptyHint: "add a Structure first — there is nothing this can point at yet.",
        when: (f) => f.interactionKind === "structure",
        hint: "the machines this element interacts with",
    },
    {
        key: "destroyerItems",
        label: "Items it destroys",
        kind: "multiselect",
        section: "What it does",
        options: listItems,
        emptyHint: "add an Item first — there is nothing this could destroy yet.",
        when: (f) => f.interactionKind === "destroyer",
    },
    {
        
        
        
        key: "entities",
        label: "Entity types",
        kind: "text",
        section: "What it does",
        when: (f) => f.interactionKind === "entity",
        placeholder: "enemy, drone",
        maxLength: 200,
        hint: "comma-separated. The engine exposes no entity list to pick from.",
    },
    textField("tipTextKey", "Tooltip text key (i18n)", "Tooltip", false, {
        placeholder: "mods|example|acid|interaction",
        maxLength: 120,
        when: hasTooltip,
    }),
    {
        key: "tipVisibility",
        label: "When to show it",
        kind: "select",
        section: "Tooltip",
        options: DATA_FIELD_MODES,
        when: hasTooltip,
    },
    numField("tipDataField", "Data field number", "Tooltip", {
        min: 1,
        max: 4,
        int: true,
        when: comparesField,
        hint: "1–4; matches the data field a structure writes",
    }),
    numField("tipDataFieldEquals", "Equals", "Tooltip", {
        min: 0,
        max: 255,
        int: true,
        when: comparesField,
    }),
    {
        key: "tipOnlyWhenTranslated",
        label: "Only if translated",
        kind: "bool",
        section: "Tooltip",
        def: "false",
        hint: "hide the label rather than showing raw text when the key has no translation",
    },
    {
        
        
        
        
        key: "interactionJson",
        label: "Fields this panel does not show",
        kind: "json",
        section: "Advanced",
        jsonType: "object",
        wide: true,
        when: (f) => splitInteraction(parseObjectOrUndefined(f.interactionJson)).unmodelled,
        hint: "carried through untouched — edit only to set a field this panel has no control for",
    },
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("elementId", read.str(e.elementId) ?? read.num(e.elementId));
    
    
    const ix = splitInteraction(e.interaction as Record<string, unknown> | undefined);
    for (const [k, v] of Object.entries(ix.fields)) read.put(k, v);
    read.put("interactionJson", read.json(e.interaction));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("elementId", w.opt("elementId"));
    
    
    
    const existing = parseObjectOrUndefined(form.interactionJson);
    const composed = composeInteraction(form);
    if (composed) {
        w.setRaw("interaction", splitInteraction(existing).unmodelled ? existing : composed);
    } else if (existing) {
        w.setRaw("interaction", existing);
    }
}




const FORM_COVERED = ["elementId", "interaction"];

export const interactionDefinition: Definition = {
    tab: "interactions",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
    
    
    
};
