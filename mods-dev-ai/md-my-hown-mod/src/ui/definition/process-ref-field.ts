
import { processRefOf } from "../../handler/processing/custom-process/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";


export const PROCESS_FORM_KEY = "processId";


export const PROCESS_STORE_KEY = "processId";


export const PROCESS_COVERED = [PROCESS_STORE_KEY];


export function readProcessRef(
    read: EntryReader,
    entry: Record<string, unknown> | undefined,
): void {
    const source = processRefOf(entry);
    read.put(PROCESS_FORM_KEY, source.kind === "process" ? source.id : "");
}


export function writeProcessRef(w: EntryWriter, enabled = true): void {
    const id = enabled ? w.opt(PROCESS_FORM_KEY) : "";
    if (id) w.setRaw(PROCESS_STORE_KEY, id);
    else w.del(PROCESS_STORE_KEY);
}


export function processRefField(slotLabel: string, extra: Partial<FieldSpec> = {}): FieldSpec {
    return {
        key: PROCESS_FORM_KEY,
        label: "Process",
        kind: "processRef",
        section: "Timing",
        wide: true,
        hint: `the named program this ${slotLabel} runs. Its steps live in the ` +
            `Processes screen, so editing one updates every ${slotLabel} that uses it.`,
        ...extra,
    };
}
