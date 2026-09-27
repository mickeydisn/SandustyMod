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
 * ## Why the form value is JSON text
 *
 * Because that is the established shape for a nested control here — `buildModes`
 * and `terrainRules` both store their list as one JSON string in the form and
 * write the real array to the entry. Reusing it means the round-trip, the
 * passthrough and the Save-blocking validation all already work, and Phase 6 can
 * replace the text box with a real ordered-list widget without touching the
 * schema.
 *
 * ## The migration
 *
 * A config already on disk holds `handlerKey: "x"`. That is read as a one-action
 * process by `actionRefsOf`, so it loads, it displays, and it keeps working. The
 * next save writes the `actions` form and drops the old key — so the migration
 * happens on the author's own edit rather than needing a separate step.
 */
import { actionRefsOf, ACTIONS_LEGACY_KEYS, type HandlerActionRef } from "../../hooks/process.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** The form key. The `Json` suffix follows `buildModesJson` and friends. */
export const ACTIONS_FORM_KEY = "actionsJson";

/** The stored key. */
export const ACTIONS_STORE_KEY = "actions";

/** Keys this field owns: the new one, and the old one it replaces. */
export const ACTIONS_COVERED = [ACTIONS_STORE_KEY, ...ACTIONS_LEGACY_KEYS];

/**
 * Parse the form's JSON text into action refs.
 *
 * Unparseable text yields `[]` and leaves the text alone, so a typo produces a
 * field error rather than silently emptying the author's process. That matches
 * `parseBuildModes`: guessing here would overwrite the text with something else.
 */
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
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((a): HandlerActionRef | null => {
            // A bare string in the list is one action with no options.
            if (typeof a === "string" && a) return { key: a };
            if (a && typeof a === "object" && typeof (a as HandlerActionRef).key === "string") {
                const ref = a as HandlerActionRef;
                // `options` is **omitted** rather than set to `undefined`, so a
                // parsed ref and a formatted ref are the same object. Setting the
                // key to `undefined` looks identical in a log and compares unequal
                // to an absent key, which is a round-trip test that fails for a
                // reason nobody can see.
                return ref.options && typeof ref.options === "object"
                    ? { key: ref.key, options: ref.options }
                    : { key: ref.key };
            }
            return null;
        })
        .filter((a): a is HandlerActionRef => a !== null && a.key !== "");
}

/** Action refs → the form's JSON text. `[]` is `""`, so an empty list is empty. */
export function formatActionRefs(refs: readonly HandlerActionRef[]): string {
    if (!refs.length) return "";
    // Omit `options` entirely when there is none, rather than writing
    // `"options": undefined` — which `JSON.stringify` drops anyway, but only
    // because the key is absent from the object. Building it explicitly keeps the
    // round trip exact: a ref with no options and a ref with `options: undefined`
    // are the same thing, and a test comparing them should not trip on the
    // difference between "absent" and "explicitly nothing".
    return JSON.stringify(
        refs.map((r) => (r.options ? { key: r.key, options: r.options } : { key: r.key })),
        null,
        2,
    );
}

/** Read a stored entry's process into the form, migrating `handlerKey`. */
export function actionRefsToForm(entry: Record<string, unknown> | undefined): string {
    return formatActionRefs(actionRefsOf(entry));
}

/**
 * Read a stored entry's process into the form, migrating `handlerKey`.
 *
 * Shared by all seven definitions so the migration is decided once. A definition
 * that re-derived this would be seven chances to read only one of the two shapes.
 */
export function readActions(
    read: EntryReader,
    entry: Record<string, unknown> | undefined,
): void {
    read.put(ACTIONS_FORM_KEY, actionRefsToForm(entry));
}

/**
 * Write the form's process onto the entry, dropping every legacy key.
 *
 * The `del` calls are the half that makes the migration real. Without them an
 * entry would keep the `getOptionsKey` / `onUpgradeKey` / `handlerKey` it was
 * migrated from *and* gain an `actions`, and which one a reader honours would
 * come down to lookup order.
 *
 * An empty process writes neither key, so clearing the control removes the
 * process rather than leaving an empty array the engine would have to interpret.
 *
 * `enabled: false` **removes** the process without writing one, which is the one
 * case where an action list is not legal at all: the item tab's Consumable. The
 * engine's `ActionType` has no Consumable, so a Consumable has nothing to
 * dispatch a use through. The form still *shows* the control's value — hiding it
 * would lose a Tool's process the moment the author switched type and back — so
 * the rule has to be applied here, on the way to the entry, not in the field.
 */
export function writeActions(w: EntryWriter, enabled = true): void {
    const refs = enabled ? parseActionRefs(w.opt(ACTIONS_FORM_KEY)) : [];
    if (refs.length > 0) {
        w.setRaw(ACTIONS_STORE_KEY, refs);
    } else {
        w.del(ACTIONS_STORE_KEY);
    }
    for (const legacy of ACTIONS_LEGACY_KEYS) w.del(legacy);
}

/**
 * The field spec, for any of the seven definitions that store a process.
 *
 * `slot` is the call site, which is what the ordered list is grouped by — so it
 * belongs in the label and the hint rather than being inferred from the tab.
 * `extra` lets a definition add its own `when` (item's is the Consumable rule)
 * without this having to know about it.
 */
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
            `an ordered list of actions, run in order when the engine calls this. ${slotLabel}. ` +
            `Each action may be repeated with different options.`,
        ...extra,
    };
}
