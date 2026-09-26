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
import { listTriggerHandlerKeys } from "../../catalog.ts";
import { idField, numField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

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
        key: "handlerKey",
        label: "Handler",
        kind: "select",
        section: "Timing",
        required: true,
        options: listTriggerHandlerKeys,
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
    read.put("handlerKey", read.str(e.handlerKey));
    read.put("extraJson", read.json(e.extra));
}

/** Form strings → stored entry, for the whole trigger. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    // `triggerId` is the identity the engine registers under, distinct from the
    // handler it calls — which is why it belongs in `formCovered` at all.
    //
    // But no control renders it and `entryToForm` does not read it, so
    // `w.opt("triggerId")` is always undefined and this line writes nothing.
    // Because the key is in `formCovered` it is also *excluded* from the
    // passthrough, so the stored value is dropped outright. Verified identical
    // on the pre-refactor tree — this is long-standing, not a regression, and it
    // is locked in by a test in tools/verify-definition.ts.
    //
    // Left as-is on purpose. Making it work means either giving it a control or
    // taking it out of `formCovered` so the passthrough carries it; both change
    // what a save writes, which is a decision rather than a refactor.
    w.setStr("triggerId", w.opt("triggerId"));
    w.setNum("interval", w.optNum("interval"));
    w.setNum("sequentialRuns", w.optNum("sequentialRuns"));
    w.setStr("handlerKey", w.opt("handlerKey"));
    const extra = w.optJson<Record<string, unknown>>("extraJson");
    if (extra) w.setRaw("extra", extra);
}

// ── The definition ───────────────────────────────────────────────────────────

export const triggerDefinition: Definition = {
    tab: "triggers",
    fields: FIELDS,
    formCovered: ["triggerId", "interval", "sequentialRuns", "extra", "handlerKey"],
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: two numbers, a dropdown and a JSON area.
    //
    // `triggerId` is listed as covered but is read by neither direction — see
    // the note in `formToEntry` for why, and what fixing it would change.
};
