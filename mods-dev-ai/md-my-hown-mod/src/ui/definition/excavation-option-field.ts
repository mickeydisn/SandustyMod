/**
 * The excavation profile's option, as a form field.
 *
 * The sibling of `../projectile-option-field.ts`, and deliberately the same shape
 * rather than a near-copy that drifts. A profile's option is **one key and one
 * parameter bag** — there is nothing to order and nothing to repeat.
 *
 * ## What it stores
 *
 * ```json
 * "option": { "key": "excavationDrill", "params": { "power": 12 } }
 * ```
 *
 * ## What it does *not* own
 *
 * `pattern` and `terrainRules` stay on the entry and stay editable. A preset
 * supplies the numbers and the seven `ExcavateOptions` flags; it has no opinion
 * about the shape of the dig or what sandstone becomes. See
 * `../../excavation-option/types.ts` for why the return is a patch and not a whole
 * profile definition.
 *
 * ## The static-power rule
 *
 * The `power` and `options` fields are **hidden while an option is chosen**, and
 * that is not a UI preference — it is which one the engine reads. `compile.ts` uses
 * the option's result and only falls back to the entry's own values when there is no
 * option, so showing an inert box would be a lie. They are still *read* and *written*
 * either way, so clearing the option restores them.
 */
import {
    EXCAVATION_OPTION_STORE_KEY,
    excavationOptionOf,
} from "../../handler/excavation-option/index.ts";
import { resolveExcavationOption } from "../../handler/excavation-option/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** The form key for the chosen option. */
export const OPTIONS_FORM_KEY = "optionKey";

/** The form key for its parameters, as JSON text. */
export const PARAMS_FORM_KEY = "optionParamsJson";

/** The stored key. */
export const OPTION_STORE_KEY = EXCAVATION_OPTION_STORE_KEY;

/** Stored keys this form owns: only the one it writes. */
export const OPTION_COVERED = [OPTION_STORE_KEY];

/** Read a stored profile's option into the form. Split from the write so the pair cannot drift. */
export function readExcavationOption(read: EntryReader, entry: Record<string, unknown>): void {
    const { ref } = excavationOptionOf(entry);
    read.put(OPTIONS_FORM_KEY, ref?.key ?? "");
    read.put(
        PARAMS_FORM_KEY,
        ref?.params ? JSON.stringify(ref.params, null, 2) : "",
    );
}

/** Write the form's option onto the entry. Empty writes nothing, returning the profile to its own power and options. */
export function writeExcavationOption(w: EntryWriter): void {
    const key = w.opt(OPTIONS_FORM_KEY);
    if (key) {
        const params = w.optJson<Record<string, unknown>>(PARAMS_FORM_KEY);
        w.setRaw(OPTION_STORE_KEY, params ? { key, params } : { key });
    } else {
        w.del(OPTION_STORE_KEY);
    }
}

/** The field spec for a profile's option. `excavationOption`, not `actionList`: one option, not a list. */
export function excavationOptionField(): FieldSpec {
    return {
        key: OPTIONS_FORM_KEY,
        label: "Option",
        kind: "excavationOption",
        section: "Profile",
        wide: true,
        hint: "one function that sets this profile's power and dig flags. Its result is " +
            "what the engine registers; leave empty to use the power and options below.",
    };
}

/** Whether the form's option key names a real option. */
export function optionKeyKnown(key: string | undefined): boolean {
    return !!key && !!resolveExcavationOption(key);
}
