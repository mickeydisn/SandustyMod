/**
 * The **custom process** object definition — the Processes screen.
 *
 * A process is the author's own handler: a named, ordered program built from the
 * atomic actions, which six definitions then *reference* rather than copy (D5).
 *
 * ## The three parts of the screen, and why they live together
 *
 * 1. **Scope** — which call site this process is for. Not decoration: it decides the
 *    context the process is handed (`../../handler/core/scope-context.ts`), and the
 *    compiler refuses the reference in any other slot.
 * 2. **The context attribute list** — *derived* from the scope and the steps, never
 *    stored. See `../../program-grid-control.ts`.
 * 3. **The program grid** — the ordered steps, each with its params and its `as`.
 *
 * Parts 2 and 3 must be in one file: the context list is computed from the steps, and
 * a definition that stored them apart would let them disagree.
 *
 * `derived` / `derivedFrom` are written by the migration in
 * `../../../config/store.ts` and passed through untouched — they are what lets a
 * cleanup pass recognise a process whose definition no longer exists.
 */
import { advField, idField, textField } from "../fields.ts";
import { HANDLER_SLOT_LABELS, type HandlerSlot } from "../../../handler/core/handler-registry.ts";
import { CALL_SITE_LABELS, CALL_SITE_SIGNATURES } from "../../../handler/core/types.ts";
import { renderProgramGrid, STEPS_FORM_KEY } from "../../program-grid-control.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";

// ── The schema ────────────────────────────────────────────────────────────────

/** Every slot a process may be built for, in the panel's display order. */
const SCOPES = Object.keys(HANDLER_SLOT_LABELS) as HandlerSlot[];

/** The scope options, each labelled with the signature it binds to. */
function scopeOptions(): { value: string; label: string }[] {
    return SCOPES.map((slot) => ({
        value: slot,
        // The signature is the whole answer to "what will this process be handed?", so
        // it belongs beside the name rather than in a hint the reader must open.
        label: `${CALL_SITE_LABELS[slot]} — ${CALL_SITE_SIGNATURES[slot]}`,
    }));
}

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Display name", "Identity", false, {
        hint: "shown in every picker that offers this process",
    }),
    {
        key: "scope",
        label: "Scope",
        kind: "select",
        section: "Identity",
        required: true,
        options: scopeOptions,
        hint: "which call site this process is for. It decides what the process can " +
            "name — a trigger is handed nothing, a processor gets the structure and " +
            "the cell context — and a process may only be used in the slot it is built for.",
    },
    textField("doc", "Description", "Identity", false, {
        maxLength: 200,
        hint: "one line on what it does",
    }),
    {
        // The program. Its own kind, because the context list beside it is *derived*
        // from these steps and no generic json or matrix control can do that.
        key: STEPS_FORM_KEY,
        label: "Program",
        kind: "program",
        section: "Program",
        wide: true,
    },
    {
        // The steps, validated but not drawn: the grid renders them as real rows.
        // `when: () => false` is the supported way to have a field that is validated
        // and never rendered.
        key: `${STEPS_FORM_KEY}__json`,
        label: "Steps",
        kind: "json",
        section: "Program",
        jsonType: "array",
        when: () => false,
    },
    advField(),
];

/** Stored entry → form strings, for the whole process. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("scope", read.str(e.scope));
    read.put("doc", read.str(e.doc));
    read.put(
        `${STEPS_FORM_KEY}__json`,
        Array.isArray(e.steps) ? JSON.stringify(e.steps, null, 2) : "",
    );
}

/** Form strings → stored entry, for the whole process. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    void form;
    w.setStr("name", w.opt("name"));
    const scope = w.opt("scope");
    // A process with no scope cannot be compiled — the context is seeded from it — so
    // it is not written rather than written broken.
    if (SCOPES.includes(scope as HandlerSlot)) w.setRaw("scope", scope);
    w.setStr("doc", w.opt("doc"));
    const steps = w.optJson<unknown[]>(`${STEPS_FORM_KEY}__json`);
    if (steps && steps.length > 0) w.setRaw("steps", steps);
    else w.del("steps");
}

/**
 * Stored keys this form owns.
 *
 * `derived` and `derivedFrom` are deliberately **absent**: the migration writes them,
 * not this form, and claiming them would make a save delete the marker that says where
 * a process came from.
 */
const FORM_COVERED = ["name", "scope", "doc", "steps"];

function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind === "program") return renderProgramGrid(ctx);
    return null;
}

export const customProcessDefinition: Definition = {
    tab: "customProcess",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate`: every rule is a field's own `required` or the json check.
    panel: { renderField },
    // A process has no engine counterpart, so there is nothing to discover — the
    // shared list is exactly right, and saying so keeps the question asked.
    list: { discover: () => [] },
};
