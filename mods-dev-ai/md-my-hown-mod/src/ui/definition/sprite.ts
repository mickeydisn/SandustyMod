/**
 * The **sprite** object definition.
 *
 * A sprite is a path to a PNG plus one flag saying where to load it from. That
 * is the whole object, and both fields are about the *file*, not about
 * appearance — the engine reads the pixels, the panel only picks the path.
 *
 * The one thing worth naming is `autoKey`. Picking a PNG from the library also
 * derives the id (`sprites:<name>`) and writes it into the id field, but only
 * when that field is empty or still holds a previous auto-generated value. The
 * rule is not "do not clobber" — it is "clobber a value *we* wrote, never one
 * a person typed", and the distinction is why `autoValue` exists.
 *
 * Ground truth: `doc/doc-tech/06-sprites-and-draws.md`.
 */
import { boolField, spriteIdField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    spriteIdField(),
    {
        key: "path",
        label: "Bundled asset",
        kind: "library",
        section: "File",
        required: true,
        wide: true,
        autoKey: "idSuffix",
        placeholder: "search icons by name…",
        hint: "pick a PNG from assets/icons/ — the path is filled in for you",
    },
    boolField("fromMod", "Load from mod folder", "File", "true"),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole sprite. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("path", read.str(e.path));
    if (typeof e.fromMod === "boolean") read.put("fromMod", String(e.fromMod));
}

/** Form strings → stored entry, for the whole sprite. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("path", w.opt("path"));
    w.setBool("fromMod", w.optBool("fromMod"));
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["path", "fromMod"];

export const spriteDefinition: Definition = {
    tab: "sprites",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: the library picker is a stock control. The
    // auto-fill rule lives in `fields.ts` beside `resolveAutoFill`, which is
    // where the "was this value ours?" question is answered.
    //
    // `source` and `options` are *not* in formCovered: nothing writes them, so
    // they fall through as a passthrough and a stored entry that has them keeps
    // them. That is the honest arrangement — claiming a key with no control is
    // how data goes missing, and this tab is where that bit three times.
};
