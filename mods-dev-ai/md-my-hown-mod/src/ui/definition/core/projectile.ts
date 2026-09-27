/**
 * The **projectile** object definition.
 *
 * A projectile is a thing a weapon throws: a sprite, and the options that describe
 * how it travels. Those options come from **exactly one** place now — a single
 * `ProjectileOption` chosen in the `Option` field, whose return the engine reads
 * directly as the spawn-time configuration.
 *
 * Modelling the option as a `Process` like the other six — a *list* of
 * `getOptions` handlers whose returns were merged field-by-field — let an author
 * store two presets whose union was a configuration nobody designed. So this
 * definition gets its own field and its own widget — see
 * `./projectile-option-field.ts` and
 * `../../projectile-option-control.ts`.
 *
 * The static `optionsJson` box is still here, and still round-trips, because a
 * projectile with no option is a legitimate thing to configure. It is only *shown*
 * when the option is empty, since that is exactly when the engine reads it.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.projectiles.md`.
 */
import { listSpriteIds } from "../../../catalog.ts";
import {
    OPTION_COVERED,
    OPTIONS_FORM_KEY,
    PARAMS_FORM_KEY,
    projectileOptionField,
    readProjectileOption,
    writeProjectileOption,
} from "../projectile-option-field.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

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
    // The one option, and not an `actionList`. It carries
    // its own key *and* its parameters, so the two live together here.
    projectileOptionField(),
    {
        // The parameters are a companion field rather than a second visible box:
        // `projectileOption` renders them as real inputs, and this one exists so
        // the form has somewhere to keep the JSON and so Save validates it. Hidden
        // rather than absent — `isActive` is checked before a field is drawn *and*
        // before it is validated, so this is the supported way to have a validated
        // but unrendered field.
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
        // Hidden once an option is chosen, because the option's result is what
        // reaches the engine. The value is still read into the form and still
        // written back, so clearing the option restores it rather than leaving a
        // projectile with no options at all.
        when: (f) => !(f[OPTIONS_FORM_KEY] ?? "").trim(),
        hint: "{ speed?, rotateWithVelocity?, tint?, … }",
        placeholder: '{ "speed": 10 }',
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole projectile. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    // One stored `sprite` object, driven by a single control.
    const sprite = e.sprite as { id?: string } | undefined;
    read.put("spriteId", read.str(sprite?.id));
    readProjectileOption(read, e);
    read.put("optionsJson", read.json(e.options));
}

/** Form strings → stored entry, for the whole projectile. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    const spriteId = w.opt("spriteId");
    if (spriteId) w.setRaw("sprite", { id: spriteId });
    writeProjectileOption(w);
    const options = w.optJson<Record<string, unknown>>("optionsJson");
    if (options) w.setRaw("options", options);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `sprite` and `options` are the stored key names, listed as themselves;
 * `spriteId` and `optionsJson` are the *controls* for them and are deliberately
 * absent, so the real keys do not also fall through the passthrough as duplicates.
 * `OPTION_COVERED` brings the option's own key plus every legacy spelling
 * (`getOptionsKey`, and the short-lived `actions` list) so none of them survive a
 * save as a second, competing reference.
 */
const FORM_COVERED = ["sprite", "options", ...OPTION_COVERED];

export const projectileDefinition: Definition = {
    tab: "projectiles",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: a dropdown, its parameters, and a JSON box.
};
