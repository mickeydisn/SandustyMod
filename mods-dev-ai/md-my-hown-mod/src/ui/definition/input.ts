/**
 * The **input binding** object definition.
 *
 * A binding is a key or control the game routes into a mod handler: a
 * `displayName` for the settings screen, a `category` to group it under, a
 * list of default keys, and a handler for press and for release.
 *
 * Two things here are not visible in the field list:
 *
 *   - `defaultKeys` is a `multiselect` over a *LooseString* union, not a closed
 *     enum. Chords like "Control+KeyC" are legal and cannot be enumerated, so
 *     the picker offers suggestions and the hint says chords are allowed. It is
 *     the one place a multiselect is not drawing from a closed set.
 *
 *   - The press and release handlers have *different signatures* and a handler
 *     serves one or the other. That is why each hint names the types the slot
 *     accepts rather than sharing one generic sentence — a short list with no
 *     explanation reads as a broken picker.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.input.md`.
 */
import { listAnyHandlerKeys, listKeyCodes } from "../../catalog.ts";
import { advField, idField, NAME_MAX, textField, typesHintFor } from "./fields.ts";
import { parseIdList } from "./values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    // api.input.registerBinding(bindingId, defaultKeys, definition)
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
        // KeyCode is a LooseString union, so this is a picker that offers
        // suggestions rather than a closed list — chords like
        // "Control+KeyC" are valid and cannot be enumerated ahead of time.
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
    {
        key: "subsectionJson",
        label: "Subsection",
        kind: "json",
        section: "Identity",
        jsonType: "object",
        wide: true,
        hint: "optional settings group: { title, titleKey, description, descriptionKey }",
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole binding. */
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

/** Form strings → stored entry, for the whole binding. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("displayName", w.opt("displayName"));
    w.setStr("displayNameKey", w.opt("displayNameKey"));
    w.setStr("category", w.opt("category"));
    // An unbound binding is valid, so an empty list writes nothing rather than
    // `defaultKeys: []`.
    const keys = parseIdList(form.defaultKeys ?? "");
    if (keys.length > 0) w.setRaw("defaultKeys", keys);
    w.setStr("onDownKey", w.opt("onDownKey"));
    w.setStr("onUpKey", w.opt("onUpKey"));
    const subsection = w.optJson<Record<string, unknown>>("subsectionJson");
    if (subsection) w.setRaw("subsection", subsection);
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
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
    // No `validate` and no `panel`: text boxes, a multiselect, two dropdowns
    // and a JSON area. The `hint` on each handler is built from the live
    // registry via `typesHintFor`, so it changes when the handlers change
    // without this file being touched.
};
