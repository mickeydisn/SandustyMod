/**
 * The projectile's option, as a form field.
 *
 * The sibling of `actions-field.ts`, and much smaller on purpose. A process is an
 * ordered list and needs an ordered editor, migration for several spellings, and a
 * per-row parameter set. A projectile's option is **one key and one parameter
 * bag** — there is nothing to order and nothing to repeat — so this module is
 * the whole of it.
 *
 * ## What it stores
 *
 * ```json
 * "option": { "key": "projectileFast", "params": { "speed": 30 } }
 * ```
 *
 * An object, not a one-element array. The short-lived `actions: [...]` form is
 * still *read* (see `projectileOptionOf`) so configs written during that window keep
 * working, but nothing writes it: a list would invite the merging behaviour this
 * refactor removed, and a single-element array is a lie about the shape.
 *
 * ## The static-options rule
 *
 * The form shows the static `options` box only when no option is chosen, and that
 * is not a UI preference — it is which one the engine reads. `registerProjectile`
 * synthesises `getOptions` from the static options only when this field is empty, so
 * with an option chosen the static box would be inert. It is still *read* and
 * *written* either way, so clearing the option restores it rather than leaving the
 * projectile with nothing at all.
 */
import { projectileOptionOf } from "../../handler/projectile-option/index.ts";
import { resolveProjectileOption } from "../../handler/projectile-option/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** The form key for the chosen option. */
export const OPTIONS_FORM_KEY = "optionKey";

/** The form key for its parameters, as JSON text. */
export const PARAMS_FORM_KEY = "optionParamsJson";

/** The stored key. */
export const OPTION_STORE_KEY = "option";

/** Stored keys this form owns: only the one it writes. */
export const OPTION_COVERED = [OPTION_STORE_KEY];

/** Read a stored projectile's option into the form. Split from the write so the pair cannot drift. */
export function readProjectileOption(read: EntryReader, entry: Record<string, unknown>): void {
    const { ref } = projectileOptionOf(entry);
    read.put(OPTIONS_FORM_KEY, ref?.key ?? "");
    read.put(
        PARAMS_FORM_KEY,
        ref?.params ? JSON.stringify(ref.params, null, 2) : "",
    );
}

/** Write the form's option onto the entry. Empty writes nothing, returning the projectile to its static options. */
export function writeProjectileOption(w: EntryWriter): void {
    const key = w.opt(OPTIONS_FORM_KEY);
    if (key) {
        const params = w.optJson<Record<string, unknown>>(PARAMS_FORM_KEY);
        w.setRaw(OPTION_STORE_KEY, params ? { key, params } : { key });
    } else {
        w.del(OPTION_STORE_KEY);
    }
}

/** The field spec for a projectile's option. `projectileOption`, not `actionList`: one option, not a list. */
export function projectileOptionField(): FieldSpec {
    return {
        key: OPTIONS_FORM_KEY,
        label: "Option",
        kind: "projectileOption",
        section: "Look",
        wide: true,
        hint: "one function that builds this projectile's options. Its result is what the " +
            "engine uses at spawn; leave empty to use the static options instead.",
    };
}

/** Whether the form's option key names a real option. */
function optionKeyKnown(key: string | undefined): boolean {
    return !!key && !!resolveProjectileOption(key);
}
