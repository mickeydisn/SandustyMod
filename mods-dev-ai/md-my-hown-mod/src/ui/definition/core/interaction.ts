/**
 * The **element interaction** object definition.
 *
 * An interaction is what a tool does to a material: crush it, burn it, drag a
 * vehicle through it. It is a *discriminated union* in the engine — one `kind`,
 * and only the fields that kind has — and it is the one tab where that union
 * shows through the form.
 *
 * Two decisions carry the tab, and both are about not destroying data:
 *
 *   - A kind emits only its own fields. Writing `entities: ""` onto a
 *     "structure" descriptor would register cleanly and then do less than the
 *     author asked, silently.
 *
 *   - A stored descriptor that holds something this panel has no control for is
 *     kept **verbatim** on save, not re-composed. Re-composing would rewrite it
 *     into a shape this panel understands, which is a data loss that looks like
 *     a successful edit. `interactionJson` only becomes visible when that
 *     actually happens.
 *
 * The split and re-join live in `../interaction.ts` rather than here, because
 * they are one function pair and the engine's union is the thing they model —
 * the form is a view of it, not its owner.
 *
 * Ground truth: `elements.d.ts`, the `ElementInteraction` union.
 */
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

/** True for the kinds that carry the tooltip block. */
const hasTooltip = (f: Record<string, string>) =>
    TOOLTIP_KINDS.includes(f.interactionKind as never);

/** True for the tooltip modes that name a data field to compare against. */
const comparesField = (f: Record<string, string>) =>
    hasTooltip(f) &&
    (f.tipVisibility === "visibleWhen" || f.tipVisibility === "crossedOutWhen");

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    elSelect("elementId", "Element", "Target", true),
    // The panel used to be one free JSON box under a label that gave no clue
    // what it was for. Now it is the `kind` union from `elements.d.ts`, with
    // only the fields the chosen kind actually has.
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
        // There is no entity registry to enumerate, so unlike the two above
        // this one really is free text. It is the only reference field in the
        // form that is, and the hint says why.
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
        // Not offered as a control. Kept in the round trip so a stored
        // descriptor — or one with a field this form does not model —
        // survives a save byte for byte. Only rendered when the stored
        // object really does hold something this panel cannot show.
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

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole interaction. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("elementId", read.str(e.elementId) ?? read.num(e.elementId));
    // Split into the kind + per-kind fields, and keep the original object
    // so a descriptor the form does not fully model is still recoverable.
    const ix = splitInteraction(e.interaction as Record<string, unknown> | undefined);
    for (const [k, v] of Object.entries(ix.fields)) read.put(k, v);
    read.put("interactionJson", read.json(e.interaction));
}

/** Form strings → stored entry, for the whole interaction. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("elementId", w.opt("elementId"));
    // Re-compose from the split fields, unless the stored object held
    // something the form does not model — then keep it verbatim rather
    // than silently rewriting it into a kind it was not.
    const existing = parseObjectOrUndefined(form.interactionJson);
    const composed = composeInteraction(form);
    if (composed) {
        w.setRaw("interaction", splitInteraction(existing).unmodelled ? existing : composed);
    } else if (existing) {
        w.setRaw("interaction", existing);
    }
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["elementId", "interaction"];

export const interactionDefinition: Definition = {
    tab: "interactions",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate`: `composeInteraction` already refuses a kind it cannot
    // build, and the form would have nothing to add — a partially filled
    // descriptor is a legitimate thing to save and re-open.
    //
    // No `panel` either. The kind picker drives visibility through `when`, which
    // is the same mechanism every other conditional field uses; a custom widget
    // here would have to re-implement it to gain nothing.
};
