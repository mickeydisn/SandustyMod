/**
 * The `actions` field: a process, as a form field.
 *
 * This is the schema half of the Process/Action split. Seven definitions store a
 * handler key today — signal, trigger, processing, projectile, upgrade, modifier,
 * item — and all seven get this one field, so the shape and the migration are
 * decided once instead of seven times.
 *
 * ## What it stores
 *
 * ```json
 * "actions": [ { "key": "processorConvert", "options": { "to": "Water" } } ]
 * ```
 *
 * The list is **ordered and repeatable**: "log then convert" and "convert then log"
 * are different behaviours, and the same action may appear twice with different
 * options. Nothing here sorts or dedupes.
 *
 * ## Blocks
 *
 * A list entry may instead be a decision, holding two more lists:
 *
 * ```json
 * "actions": [
 *   { "key": "isElementAtCell", "as": "wet", "options": { "element": "water" } },
 *   { "key": "if", "options": { "var": "wet" },
 *     "then": [ { "key": "removeElement" } ],
 *     "else": [ { "key": "toast", "options": { "message": "dry" } } ] }
 * ]
 * ```
 *
 * The condition is the truthiness of a **named variable**, not an expression — a
 * block branches on something an earlier step already bound and computes nothing
 * itself. The field is JSON text, so blocks work here with no new widget: the text
 * is the editor until one is built, exactly as it was for the flat list.
 *
 * ## Why the form value is JSON text
 *
 * Because that is the established shape for a nested control here — `buildModes`
 * and `terrainRules` both store their list as one JSON string in the form and
 * write the real array to the entry. Reusing it means the round-trip, the
 * passthrough and the Save-blocking validation all already work, and Phase 6 can
 * replace the text box with a real ordered-list widget without touching the
 * schema.
 *
 * ## No migration
 *
 * A config written before the split holds `handlerKey: "x"` and no `actions`.
 * That is read as *no process*: the author sees an empty list rather than a
 * process that is listed but does not run. The pre-split key is left in the
 * entry by the passthrough — this field does not claim it — so nothing is
 * destroyed, but it is no longer honoured.
 */
import { actionRefsOf, type HandlerActionRef } from "../../handler/core/process.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** The form key. The `Json` suffix follows `buildModesJson` and friends. */
export const ACTIONS_FORM_KEY = "actionsJson";

/** The stored key. */
export const ACTIONS_STORE_KEY = "actions";

/**
 * Keys this field owns: only the one it writes.
 *
 * The pre-split spellings are deliberately absent. Listing them would make the
 * passthrough strip a `handlerKey` the form never reads, so an author who had
 * not opened the entry would lose it without ever seeing why.
 */
export const ACTIONS_COVERED = [ACTIONS_STORE_KEY];

/**
 * One ref out of a parsed list, or `null` for a shape we do not read.
 *
 * Recursive, because a block holds more lists. Kept in one place so parse and format
 * agree on what a ref *is* — two implementations of the same shape is how a block ends
 * up parsing and never coming back.
 */
function oneRef(a: unknown): HandlerActionRef | null {
    // A bare string in the list is one action with no options.
    if (typeof a === "string" && a) return { key: a };
    if (!a || typeof a !== "object") return null;
    const raw = a as Record<string, unknown>;
    if (typeof raw.key !== "string" || !raw.key) return null;
    const ref: HandlerActionRef = { key: raw.key };
    // `options` is **omitted** rather than set to `undefined`, so a parsed ref and a
    // formatted ref are the same object. Setting the key to `undefined` looks identical
    // in a log and compares unequal to an absent key, which is a round-trip test that
    // fails for a reason nobody can see.
    if (raw.options && typeof raw.options === "object") {
        ref.options = raw.options as Record<string, unknown>;
    }
    if (typeof raw.as === "string" && raw.as) ref.as = raw.as;
    // A block's arms, recursively. An empty array is dropped so `{"then": []}` does not
    // come back as a key the compiler then treats as present.
    if (Array.isArray(raw.then)) {
        const then = parseList(raw.then);
        if (then.length) ref.then = then;
    }
    if (Array.isArray(raw.else)) {
        const otherwise = parseList(raw.else);
        if (otherwise.length) ref.else = otherwise;
    }
    return ref;
}

/** A list of refs, dropping the shapes we do not read. */
function parseList(list: unknown): HandlerActionRef[] {
    if (!Array.isArray(list)) return [];
    return list.map(oneRef).filter((a): a is HandlerActionRef => a !== null);
}

/** Parse the form's JSON into action refs. Unparseable text yields `[]` and is left alone. */
export function parseActionRefs(raw: string | undefined): HandlerActionRef[] {
    if (!raw || !raw.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    // A bare string is a one-action process, so a hand-written `"processorLog"`
    // works. Anything else must be a list, and a wrong shape is left to the
    // field's own error rather than coerced.
    if (typeof parsed === "string") return [{ key: parsed }];
    return parseList(parsed);
}

/** One ref back to JSON, keeping only the keys this module reads. */
function oneToJson(r: HandlerActionRef): Record<string, unknown> {
    const out: Record<string, unknown> = { key: r.key };
    if (r.options) out.options = r.options;
    if (r.as) out.as = r.as;
    if (r.then?.length) out.then = r.then.map(oneToJson);
    if (r.else?.length) out.else = r.else.map(oneToJson);
    return out;
}

/** Action refs → the form's JSON text. `[]` is `""`, so an empty list is empty. */
export function formatActionRefs(refs: readonly HandlerActionRef[]): string {
    if (!refs.length) return "";
    // Keys are added by `oneToJson` rather than left to `JSON.stringify` dropping the
    // undefined ones, so a ref with no options and a ref with `options: undefined` are
    // the same thing and a round-trip test does not trip on the difference between
    // "absent" and "explicitly nothing".
    return JSON.stringify(refs.map(oneToJson), null, 2);
}

/** Read a stored entry's process into the form. */
export function actionRefsToForm(entry: Record<string, unknown> | undefined): string {
    return formatActionRefs(actionRefsOf(entry));
}

/** Read a stored entry's process into the form. Shared by all seven definitions so the shape is decided once. */
export function readActions(
    read: EntryReader,
    entry: Record<string, unknown> | undefined,
): void {
    read.put(ACTIONS_FORM_KEY, actionRefsToForm(entry));
}

/** Write the form's process onto the entry. Empty writes no key; `enabled: false` removes it. */
export function writeActions(w: EntryWriter, enabled = true): void {
    const refs = enabled ? parseActionRefs(w.opt(ACTIONS_FORM_KEY)) : [];
    if (refs.length > 0) {
        w.setRaw(ACTIONS_STORE_KEY, refs);
    } else {
        w.del(ACTIONS_STORE_KEY);
    }
}

/** The field spec for the seven definitions that store a process. `extra` adds a definition's own `when`. */
export function actionListField(
    slotLabel: string,
    extra: Partial<FieldSpec> = {},
): FieldSpec {
    return {
        key: ACTIONS_FORM_KEY,
        label: "Process",
        kind: "actionList",
        section: "Timing",
        jsonType: "array",
        wide: true,
        hint:
            `an ordered list of actions, run in order when the engine calls this. ` +
            `${slotLabel}. Each action may be repeated with different options. ` +
            `An entry of { "key": "if", "options": { "var": "name" }, "then": [...], ` +
            `"else": [...] } branches on whether a bound variable is true.`,
        ...extra,
    };
}
