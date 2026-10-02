import { listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";
import { placementConfigProblem } from "../../../config/placement.ts";
import type { PlacementFieldConfig } from "../../../constants.ts";

const FIELDS_FORM_KEY = "fieldsJson";

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

function readFields(raw: string): PlacementFieldConfig[] | undefined {
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? (v as PlacementFieldConfig[]) : undefined;
    } catch {
        return undefined;
    }
}

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("structureId", read.str(e.structureId));
    read.put(FIELDS_FORM_KEY, read.json(e.fields));
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureId", w.opt("structureId"));
    const fields = w.optJson<PlacementFieldConfig[]>(FIELDS_FORM_KEY);
    if (Array.isArray(fields) && fields.length > 0) w.setRaw("fields", fields);
    else w.del("fields");
}

function validate(form: Record<string, string>, errors: Record<string, string>): void {
    const raw = (form[FIELDS_FORM_KEY] ?? "").trim();

    if (!raw) return;
    const problem = placementConfigProblem({
        structureId: form.structureId ?? "",
        fields: readFields(raw),
    });
    if (!problem) return;
    errors[problem.field === "fields" ? FIELDS_FORM_KEY : problem.field] = problem.message;
}

const FORM_COVERED = ["structureId", "fields"];

export const placementConfigDefinition: Definition = {
    tab: "placementConfigs",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,

    onNewEntry(form: Record<string, string>): void {
        form[FIELDS_FORM_KEY] = JSON.stringify(
            [{ type: "integer", id: "amount", label: "Amount", min: 1, max: 1 }],
            null,
            2,
        );
    },
};
