
import {
    EXCAVATION_OPTION_STORE_KEY,
    excavationOptionOf,
} from "../../handler/processing/excavation-option/index.ts";
import { resolveExcavationOption } from "../../handler/processing/excavation-option/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "../definition/types.ts";


export const OPTIONS_FORM_KEY = "optionKey";


export const PARAMS_FORM_KEY = "optionParamsJson";


export const OPTION_STORE_KEY = EXCAVATION_OPTION_STORE_KEY;


export const OPTION_COVERED = [OPTION_STORE_KEY];


export function readExcavationOption(read: EntryReader, entry: Record<string, unknown>): void {
    const { ref } = excavationOptionOf(entry);
    read.put(OPTIONS_FORM_KEY, ref?.key ?? "");
    read.put(
        PARAMS_FORM_KEY,
        ref?.params ? JSON.stringify(ref.params, null, 2) : "",
    );
}


export function writeExcavationOption(w: EntryWriter): void {
    const key = w.opt(OPTIONS_FORM_KEY);
    if (key) {
        const params = w.optJson<Record<string, unknown>>(PARAMS_FORM_KEY);
        w.setRaw(OPTION_STORE_KEY, params ? { key, params } : { key });
    } else {
        w.del(OPTION_STORE_KEY);
    }
}


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


export function optionKeyKnown(key: string | undefined): boolean {
    return !!key && !!resolveExcavationOption(key);
}
