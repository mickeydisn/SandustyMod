/**
 * The **signal** object definition.
 *
 * A signal binds a game event — a structure being clicked, a signal being
 * received, a signal being sent — to a structure and a code callback. It is the
 * most minimal object in the panel: three fields past the id, no widget of its
 * own, and no cross-field rule.
 *
 * The one thing worth writing down is why `handlerKey` is `required`. Without
 * it the entry stores cleanly and is then never attached to anything, which is
 * a silent no-op the author has no way to notice from the list screen.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.signals.md`.
 */
import { listSignalHandlerKeys, listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

/** The three signal kinds. `interactables` fires on a click; the others relay. */
const KINDS = [
    { value: "interactables", label: "interactables — structure click" },
    { value: "targets", label: "targets — signal receiver" },
    { value: "senderType", label: "senderType — signal sender" },
];

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "kind",
        label: "Kind",
        kind: "select",
        section: "Signal",
        required: true,
        def: "interactables",
        options: KINDS,
    },
    {
        key: "target",
        label: "Target structure",
        kind: "select",
        section: "Signal",
        required: true,
        options: listStructures,
    },
    {
        key: "handlerKey",
        label: "Handler",
        kind: "select",
        section: "Signal",
        required: true,
        options: listSignalHandlerKeys,
        hint: "code callback — without it the entry is stored but never attached",
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole signal. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("kind", read.str(e.kind));
    read.put("target", read.str(e.target) ?? read.num(e.target));
    read.put("handlerKey", read.str(e.handlerKey));
}

/** Form strings → stored entry, for the whole signal. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("kind", w.opt("kind"));
    w.setStr("target", w.opt("target"));
    w.setStr("handlerKey", w.opt("handlerKey"));
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["kind", "target", "handlerKey"];

export const signalDefinition: Definition = {
    tab: "signals",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: three dropdowns, and every rule is the
    // `required` flag. A definition that is nothing but schema plus a round trip
    // is a real outcome, and recording it here means its absence is a decision
    // rather than something left to be wondered about later.
};
