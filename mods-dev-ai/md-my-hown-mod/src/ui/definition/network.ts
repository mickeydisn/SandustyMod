/**
 * The **energy network** object definition.
 *
 * The smallest tab in the panel, and the most misleading. A network is *not* an
 * engine object: `api.energy.registerType` never sees a network, it sees an
 * `options.energyType` string, and two energy types share a network only when
 * they spell that string the same way.
 *
 * So the whole thing is a list of names that produce ids for other tabs to
 * reference. `name` is display-only and the engine never receives it — which is
 * why it is optional and why the hint says so. A tab that looked like it
 * registered something with the engine, and did not, is exactly the kind of
 * thing to make obvious in the field's own text rather than leave to a
 * changelog.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.energy.md`.
 */
import { advField, DESC_MAX, idField, textField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Display name", "Identity", false, {
        maxLength: DESC_MAX,
        hint: "optional — shown in this list; the engine only ever sees the id",
    }),
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole network. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
}

/** Form strings → stored entry, for the whole network. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    // Panel-only: the engine reads neither field, it only ever sees the id two
    // energy types have to spell the same way to share a channel.
    w.setStr("name", w.opt("name"));
}

// ── The definition ───────────────────────────────────────────────────────────

export const networkDefinition: Definition = {
    tab: "networks",
    fields: FIELDS,
    formCovered: ["name"],
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: an id and an optional label. The absence of
    // a `validate` here is the point — there is nothing that can be wrong, and
    // a rule invented to fill the slot would only reject valid input.
};
