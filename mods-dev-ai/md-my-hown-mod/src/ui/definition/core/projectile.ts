import { listSpriteIds } from "../../../catalog.ts";
import {
    OPTION_COVERED,
    OPTIONS_FORM_KEY,
    PARAMS_FORM_KEY,
    projectileOptionField,
    readProjectileOption,
    writeProjectileOption,
} from "../../control/projectile-option-field.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "spriteId",
        label: "Sprite",
        kind: "select",
        section: "Look",
        required: true,
        options: listSpriteIds,
    },

    projectileOptionField(),
    {
        key: PARAMS_FORM_KEY,
        label: "Parameters",
        kind: "json",
        section: "Look",
        jsonType: "object",
        when: () => false,
    },
    {
        key: "optionsJson",
        label: "Static options",
        kind: "json",
        section: "Look",
        jsonType: "object",
        wide: true,

        when: (f) => !(f[OPTIONS_FORM_KEY] ?? "").trim(),
        hint: "{ speed?, rotateWithVelocity?, tint?, … }",
        placeholder: '{ "speed": 10 }',
    },
];

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    const sprite = e.sprite as { id?: string } | undefined;
    read.put("spriteId", read.str(sprite?.id));
    readProjectileOption(read, e);
    read.put("optionsJson", read.json(e.options));
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    const spriteId = w.opt("spriteId");
    if (spriteId) w.setRaw("sprite", { id: spriteId });
    writeProjectileOption(w);
    const options = w.optJson<Record<string, unknown>>("optionsJson");
    if (options) w.setRaw("options", options);
}

const FORM_COVERED = ["sprite", "options", ...OPTION_COVERED];

export const projectileDefinition: Definition = {
    tab: "projectiles",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
