
import { projectileOptionOf } from "../../handler/projectile-option/index.ts";
import { resolveProjectileOption } from "../../handler/projectile-option/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";


export const OPTIONS_FORM_KEY = "optionKey";


export const PARAMS_FORM_KEY = "optionParamsJson";


export const OPTION_STORE_KEY = "option";


export const OPTION_COVERED = [OPTION_STORE_KEY];


export function readProjectileOption(read: EntryReader, entry: Record<string, unknown>): void {
    const { ref } = projectileOptionOf(entry);
    read.put(OPTIONS_FORM_KEY, ref?.key ?? "");
    read.put(
        PARAMS_FORM_KEY,
        ref?.params ? JSON.stringify(ref.params, null, 2) : "",
    );
}


export function writeProjectileOption(w: EntryWriter): void {
    const key = w.opt(OPTIONS_FORM_KEY);
    if (key) {
        const params = w.optJson<Record<string, unknown>>(PARAMS_FORM_KEY);
        w.setRaw(OPTION_STORE_KEY, params ? { key, params } : { key });
    } else {
        w.del(OPTION_STORE_KEY);
    }
}


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


function optionKeyKnown(key: string | undefined): boolean {
    return !!key && !!resolveProjectileOption(key);
}
