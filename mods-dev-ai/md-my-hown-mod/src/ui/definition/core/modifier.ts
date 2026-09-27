/**
 * The **modifier** object definition.
 *
 * A modifier is a hook subscription: a place in the engine's pipeline, a mode
 * (observe-and-cancel, or transform-the-value), and a handler to run there.
 *
 * The interesting field is `hookId`, and it exists because `doc-tech/03` is a
 * *partial* list. A mod can hook something the documentation has not caught up
 * with, so the form is a picker over the documented hooks plus a companion text
 * box — the same picker/custom contract a tech's currency uses, which is why it
 * goes through the shared `putCustomOrSelect` rather than its own copy.
 *
 * The `intercept` / `modify` split is the only other decision, and it is a real
 * one: they are not two labels for the same thing, and the hint says which
 * behaviour you get.
 *
 * Ground truth: `doc/doc-tech/03-hooks-reference.md`.
 */
import { listHandlerKeys, listHookIds } from "../../../catalog.ts";
import { boolField, idField, textField } from "../fields.ts";
import { putCustomOrSelect } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "hookId",
        label: "Engine hook",
        kind: "select",
        section: "Hook",
        required: true,
        options: listHookIds,
        hint: "documented hooks only — see doc-tech/03",
    },
    textField("hookCustom", "Custom hook id", "Hook", true, {
        when: (f) => f.hookId === "__custom__",
        pattern: "^[a-z][a-z0-9]*(:[a-zA-Z0-9]+)+$",
        patternMsg: "e.g. element:update",
    }),
    {
        key: "kind",
        label: "Mode",
        kind: "select",
        section: "Hook",
        required: true,
        def: "intercept",
        options: [
            { value: "intercept", label: "intercept — observe, can cancel" },
            { value: "modify", label: "modify — transform the value" },
        ],
    },
    {
        key: "handlerKey",
        label: "Code handler",
        kind: "select",
        section: "Hook",
        required: true,
        options: listHandlerKeys,
        hint: "defined in src/hooks/handlers.ts",
    },
    boolField("enabled", "Enabled", "Hook", "true"),
    textField("notes", "Notes", "Hook", false, { maxLength: 120 }),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole modifier. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    // A hook id outside the documented list round-trips via the custom box.
    putCustomOrSelect(read.put, read.str(e.hookId), "hookId", "hookCustom", listHookIds());
    read.put("kind", read.str(e.kind));
    read.put("handlerKey", read.str(e.handlerKey));
    read.put("notes", read.str(e.notes));
    if (typeof e.enabled === "boolean") read.put("enabled", String(e.enabled));
}

/** Form strings → stored entry, for the whole modifier. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    // The companion box wins when it has something, otherwise the selection.
    // The two are mutually exclusive by construction — the read above writes one
    // or the other — so this cannot disagree with itself in practice.
    w.setStr("hookId", w.opt("hookCustom") ?? w.opt("hookId"));
    w.setStr("kind", w.opt("kind"));
    w.setStr("handlerKey", w.opt("handlerKey"));
    w.setStr("notes", w.opt("notes"));
    w.setBool("enabled", w.optBool("enabled"));
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["hookId", "kind", "handlerKey", "enabled", "notes"];

export const modifierDefinition: Definition = {
    tab: "modifiers",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate`: `hookCustom` already carries the `ns:verb` pattern, and
    // that is the whole rule a hook id has. No `panel` either — a picker and
    // its companion box is what `when` is for.
};
