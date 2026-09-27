/**
 * The **structure processor** object definition.
 *
 * A processor runs a handler, on an interval, for every placed instance of a
 * structure type. Three fields, and one of them is a correction worth keeping:
 *
 *   The registration is keyed by *structure type*, not by a placed instance.
 *   There is no "single instance" mode — an earlier version of this panel
 *   offered a `mode` / `structureId` pair that the engine never had. Both were
 *   removed rather than left to mislead, so a mod that reaches for them finds
 *   one honest field instead of two that appear to work and do not.
 *
 * The handler cannot be typed into a JSON box — callbacks are code — so this is
 * a picker over the declared processor registry. That is the only shape that can
 * work, and saying so in the hint is cheaper than a stack trace.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.structures.md`.
 */
import { listStructures } from "../../../catalog.ts";
import { actionListField, ACTIONS_COVERED, readActions, writeActions } from "../actions-field.ts";
import { advField, idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        // api.structures.processing.register(id, { structureType, intervalMs, process }).
        // There is NO "single instance" mode — the definition is keyed by
        // *structure type*, so the old mode/structureId pair was invented.
        key: "structureType",
        label: "Structure type",
        kind: "select",
        section: "Target",
        required: true,
        options: listStructures,
        hint: "process() runs for every placed instance of this structure type",
    },
    numField("intervalMs", "Interval (ms)", "Timing", {
        required: true,
        min: 16,
        max: 60000,
        def: "1000",
        hint: "must be > 0 — how often the callback fires per instance",
    }),
    {
        // Was a `select` over `listDescribedProcessorKeys` picking exactly one
        // handlerKey. `processorConvert`'s `to` was the casualty of that: a
        // `required` field the engine was never given, so it silently did
        // nothing. A process binds each action's options itself.
        ...actionListField("runs on the interval, for every instance of the structure type"),
        section: "Timing",
        required: true,
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole processor. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    // A structure type is a string id, but a numeric one from a hand-edited
    // config reads as a number — accept both rather than blanking the picker.
    read.put("structureType", read.str(e.structureType) ?? read.num(e.structureType));
    read.put("intervalMs", read.num(e.intervalMs));
    readActions(read, e);
}

/** Form strings → stored entry, for the whole processor. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureType", w.opt("structureType"));
    w.setNum("intervalMs", w.optNum("intervalMs"));
    writeActions(w);
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["structureType", "intervalMs", ...ACTIONS_COVERED];

export const processingDefinition: Definition = {
    tab: "processing",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: a dropdown, a number and another dropdown.
    // The removed `mode` / `structureId` pair is the reason there is no rule
    // about "which kind of registration is this" — the question no longer has
    // two answers to confuse.
};
