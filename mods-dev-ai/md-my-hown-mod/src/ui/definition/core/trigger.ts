/**
 * The **trigger** object definition.
 *
 * A trigger fires a handler on a tick interval. Small, but it owns one decision
 * that is not visible in the field list: `triggerId` is read and written even
 * though it is not a control.
 *
 * That is because a trigger's identity and its handler are separate: the engine
 * registers under `triggerId` and calls the function named by `handlerKey`. A
 * panel that only wrote the handler would rename the trigger on every save.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.input.md`.
 */
import {
    PROCESS_COVERED,
    processRefField,
    readProcessRef,
    writeProcessRef,
} from "../process-ref-field.ts";
import { idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    numField("interval", "Interval (ticks)", "Timing", {
        required: true,
        min: 1,
        max: 100000,
        def: "60",
    }),
    numField("sequentialRuns", "Runs per fire", "Timing", { min: 1, max: 1000, def: "1" }),
    {
        // Was a `select` over `listTriggerHandlerKeys` picking exactly one
        // handlerKey. A trigger is a process now.
        ...processRefField("runs on the interval"),
        section: "Timing",
        required: true,
    },
    {
        key: "extraJson",
        label: "Extra payload",
        kind: "json",
        section: "Timing",
        jsonType: "object",
        wide: true,
        placeholder: "{ }",
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole trigger. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("interval", read.num(e.interval));
    read.put("sequentialRuns", read.num(e.sequentialRuns));
    readProcessRef(read, e);
    read.put("extraJson", read.json(e.extra));
}

/** Form strings → stored entry, for the whole trigger. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setNum("interval", w.optNum("interval"));
    w.setNum("sequentialRuns", w.optNum("sequentialRuns"));
    writeProcessRef(w);
    const extra = w.optJson<Record<string, unknown>>("extraJson");
    if (extra) w.setRaw("extra", extra);
    // `triggerId` is not written here. It has no control, so there is nothing
    // to read — and the passthrough already carries the stored value, because
    // it is absent from `formCovered`. See the note on the definition below.
}

// ── The definition ───────────────────────────────────────────────────────────

export const triggerDefinition: Definition = {
    tab: "triggers",
    fields: FIELDS,
    // No `validate` and no `panel`: two numbers, a dropdown and a JSON area.
    //
    // `triggerId` is deliberately NOT in `formCovered`. It has no control, and
    // claiming a key with no control is what deleted it: `passthroughOf` skips
    // covered keys, so a stored `triggerId` was shown nowhere, carried nowhere,
    // and gone on the next save.
    //
    // So it rides the passthrough instead, which means it shows up in the
    // "Fields this panel does not show" box. That is the honest place for a
    // stored key the form genuinely cannot edit, and it is the first time it
    // has been visible at all.
    formCovered: ["interval", "sequentialRuns", "extra", ...PROCESS_COVERED],
    entryToForm,
    formToEntry,
};
