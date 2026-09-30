/**
 * The **placement config** object definition — `structures.registerPlacementConfig`.
 *
 * A placement config is the row of sliders and pickers the player sees while
 * holding a building, before it is placed: an integer field clamps a number to
 * `min`/`max`, a choice field maps a value onto one of a fixed set of labelled
 * options. The chosen values ride along on the placed structure's `data`.
 *
 * ## What this is not
 *
 * It is not a cap on how many of a structure may be placed. That was the first
 * assumption when this node was asked for, and it is worth writing down why it
 * is wrong, because the engine's API invites the mistake: there *is* a
 * `maxCount`, and `registerPlacementConfig` is the call that looks like it should
 * take it. It does not. The payload is `{ structureId, fields }` (bundel 88861),
 * and the engine's built-in `maxCount` is unreachable from a mod — bundel 5251
 * guards the whole branch with `if (u.structureType === a.ev.GloomEmitter)`.
 * Capping a count means `hooks.intercept("building:place", …)` and a cancel.
 *
 * ## Why `fields` is one JSON box
 *
 * The alternative is a repeating-row editor, which is what `buildModes` and
 * `terrainRules` use. Those earn it because every row has the *same* two or three
 * fields. A placement field is a discriminated union — `integer` carries
 * `min`/`max`/`default`, `choice` carries `options` — and a choice's `options` are
 * themselves a list of `{value, label}`. A row editor would need a type picker
 * per row *and* a nested sub-list, which is more machinery than the thing is
 * worth for a field most authors write once per structure.
 *
 * So the list is JSON, and what makes that acceptable is `validate` below: the
 * rules the engine throws on are checked with the engine's own wording, at save
 * time, before the author can ship a config that would throw at boot. The panel
 * is where a bad entry is caught, and `src/config/placement.ts` is the single
 * implementation of those rules, shared with the register wrapper.
 */
import { listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";
import { placementConfigProblem } from "../../../config/placement.ts";
import type { PlacementFieldConfig } from "../../../constants.ts";

/**
 * The control key for the fields box. The *stored* key is `fields`.
 *
 * Suffixed so the passthrough can tell the control from the key it writes — the
 * same reason `behavior.ts` calls its box `definitionJson`.
 */
const FIELDS_FORM_KEY = "fieldsJson";

/** The engine's own words for the one complaint the panel has to word itself. */
const NEEDS_STRUCTURE_AND_FIELDS = "Placement config requires a structureId and fields.";

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "structureId",
        label: "Structure",
        kind: "select",
        section: "Placement fields",
        required: true,
        options: listStructures,
        hint: "the building these fields belong to. The engine keys the config by this id " +
            "and only reads it while that building is selected",
    },
    {
        key: FIELDS_FORM_KEY,
        label: "Fields",
        kind: "json",
        section: "Placement fields",
        required: true,
        jsonType: "array",
        wide: true,
        placeholder: '[ { "type": "integer", "id": "tier", "label": "Tier", "min": 1, "max": 3 } ]',
        hint: "one or more hotbar fields. Each needs type (integer|choice), a unique id, and a " +
            "label or a labelKey. A choice also needs a non-empty options[] of " +
            "{value, label|labelKey}.",
    },
];

/**
 * Parse the box, or `undefined` when it is not a JSON array.
 *
 * An unparseable box is *not* this function's error to report: `validateField`
 * already flags invalid JSON against the same control, and a second message
 * about the same text would leave the author with two complaints for one
 * mistake. So the cross-field pass treats "not an array" as "nothing further to
 * check" and lets that one message stand.
 */
function readFields(raw: string): PlacementFieldConfig[] | undefined {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? (v as PlacementFieldConfig[]) : undefined;
    } catch {
        return undefined;
    }
}

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("structureId", read.str(e.structureId));
    read.put(FIELDS_FORM_KEY, read.json(e.fields));
}

/**
 * Form strings → stored entry.
 *
 * `fields` is written only when it parsed to a non-empty array. An empty list is
 * not written as `[]` because the engine throws on it — so persisting one would
 * save a config that is listed, counted as registered, and then rejected at
 * every boot. Omitting the key is the same "not configured yet" a blank control
 * means everywhere else in the panel.
 */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureId", w.opt("structureId"));
    const fields = w.optJson<PlacementFieldConfig[]>(FIELDS_FORM_KEY);
    if (Array.isArray(fields) && fields.length > 0) w.setRaw("fields", fields);
    else w.del("fields");
}

/**
 * The engine's rules, reported against the control that caused the break.
 *
 * `placementConfigProblem` returns the engine's own sentence for the *first*
 * rule broken, because a list of five over one text box would be five lines the
 * author fixes one save at a time anyway. The one case this file words itself is
 * the missing-`structureId`-and-fields complaint, which names two different
 * mistakes at once — a blank structure picker and an empty field list are
 * separate errors on separate controls, and merging them would underline the
 * wrong box.
 */
function validate(form: Record<string, string>, errors: Record<string, string>): void {
    const raw = (form[FIELDS_FORM_KEY] ?? "").trim();
    // A blank box is already a `required` error; adding a second one for the same
    // blank would be two messages for one mistake.
    if (!raw) return;
    const problem = placementConfigProblem({
        id: "form",
        structureId: form.structureId ?? "",
        fields: readFields(raw),
    });
    if (!problem) return;
    if (problem === NEEDS_STRUCTURE_AND_FIELDS) {
        if (!(form.structureId ?? "").trim()) errors.structureId = "pick a structure";
        else errors[FIELDS_FORM_KEY] = "at least one field is required";
        return;
    }
    errors[FIELDS_FORM_KEY] = problem;
}

/** Stored keys this form owns. `id` is composed by the panel from `idSuffix`. */
const FORM_COVERED = ["structureId", "fields"];

export const placementConfigDefinition: Definition = {
    tab: "placementConfigs",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,
    // No `panel` and no `list`: this is a structure *reference* plus a payload,
    // and the shared list already shows the id. A bespoke row would add nothing
    // to read.
    onNewEntry(form: Record<string, string>): void {
        // A new row that cannot save is a dead end. Seeding one valid field means
        // the form opens on something the author edits rather than on an empty
        // array the engine would reject. `min` and `max` are both 1 so the
        // example is a *legal* single-value slider, not a range that looks like
        // a mistake.
        form[FIELDS_FORM_KEY] = JSON.stringify(
            [{ type: "integer", id: "amount", label: "Amount", min: 1, max: 1 }],
            null,
            2,
        );
    },
};
