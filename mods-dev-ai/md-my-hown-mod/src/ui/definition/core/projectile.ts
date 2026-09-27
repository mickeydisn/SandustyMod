/**
 * The **projectile** object definition.
 *
 * A projectile is a thing a weapon throws: a sprite, and the options that
 * describe how it travels. It is the only object whose options can come from
 * *two* places — a stored `options` object, or a `getOptionsKey` code callback
 * that builds them at runtime — and the callback wins. So the form makes the
 * static box conditional on the handler being empty: a projectile that computes
 * its own options has nothing useful to type into a box the engine will ignore,
 * and showing it invites an author to fill in a field that does nothing.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.projectiles.md`.
 */
import { listProjectileHandlerKeys, listSpriteIds } from "../../catalog.ts";
import { idField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

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
    {
        key: "getOptionsKey",
        label: "Options handler",
        kind: "select",
        section: "Look",
        options: listProjectileHandlerKeys,
        hint: "dynamic options factory (optional) — overrides the static options below",
    },
    {
        key: "optionsJson",
        label: "Static options",
        kind: "json",
        section: "Look",
        jsonType: "object",
        wide: true,
        // Hidden once a handler is chosen, because the handler's options are the
        // ones that reach the engine. The value is still read into the form and
        // still written back, so clearing the handler restores it rather than
        // leaving a projectile with no options at all.
        when: (f) => f.getOptionsKey === "",
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
    read.put("getOptionsKey", read.str(e.getOptionsKey));
    read.put("optionsJson", read.json(e.options));
}

/** Form strings → stored entry, for the whole projectile. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    const spriteId = w.opt("spriteId");
    if (spriteId) w.setRaw("sprite", { id: spriteId });
    w.setStr("getOptionsKey", w.opt("getOptionsKey"));
    const options = w.optJson<Record<string, unknown>>("optionsJson");
    if (options) w.setRaw("options", options);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `sprite` and `options` are the stored key names, listed as themselves;
 * `spriteId` and `optionsJson` are the *controls* for them and are deliberately
 * absent, so the real keys do not also fall through the passthrough as
 * duplicates. `getOptionsKey` is both, and is listed.
 */
const FORM_COVERED = ["sprite", "getOptionsKey", "options"];

export const projectileDefinition: Definition = {
    tab: "projectiles",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: a dropdown, a dropdown and a JSON box. The
    // only rule is the `when` that hides the static options behind a handler.
};
