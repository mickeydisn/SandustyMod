/**
 * A definition's **process reference**, as a form field.
 *
 * The replacement for `actions-field.ts` on every definition that used to store an
 * inline `actions` array. Same three pieces as the option fields — a form key, a
 * store key, a read/write pair — and the same reason they are a separate module: the
 * shape is decided once, so seven definitions cannot disagree about it.
 *
 * ## What it stores
 *
 * ```json
 * "processId": "sort-by-density"
 * ```
 *
 * **A string, not a copy of the steps** (D5). That is the whole feature: a definition
 * names a program rather than owning one, so editing the process changes every
 * definition that names it. A `select` — not a JSON textarea — because the value is
 * one id and the panel has the list.
 *
 * ## The legacy array
 *
 * Still **read**, so a config that has not been through the migration round-trips, and
 * shown in the field's own words rather than silently dropped. Nothing writes it; the
 * migration in `../../../config/store.ts` owns that shape now.
 */
import { processRefOf } from "../../handler/custom-process/index.ts";
import type { EntryReader, EntryWriter, FieldSpec } from "./types.ts";

/** The form key for the chosen process. */
export const PROCESS_FORM_KEY = "processId";

/** The stored key. The same name as the form key — a bare id has no shape. */
export const PROCESS_STORE_KEY = "processId";

/** Stored keys this form owns. The legacy array is deliberately **not** claimed. */
export const PROCESS_COVERED = [PROCESS_STORE_KEY];

/**
 * Read a stored entry's process into the form.
 *
 * A legacy array is put in the form as a **literal, read-only marker** rather than
 * parsed. The author cannot edit it here — the steps now live in a derived process —
 * and pretending otherwise would invite a save that writes an array nothing reads.
 */
export function readProcessRef(
    read: EntryReader,
    entry: Record<string, unknown> | undefined,
): void {
    const source = processRefOf(entry);
    if (source.kind === "process") {
        read.put(PROCESS_FORM_KEY, source.id);
    } else if (source.kind === "legacy") {
        read.put(PROCESS_FORM_KEY, "");
        // The marker is informational; it lives under a *form* key so there is no
        // stored key to clean up, and a later write simply leaves it in the form.
        read.put(`${PROCESS_FORM_KEY}__legacy`, String(source.refs.length));
    } else {
        read.put(PROCESS_FORM_KEY, "");
    }
}

/**
 * Write the form's process onto the entry.
 *
 * `enabled: false` removes the key, which is how the **Consumable** rule is
 * expressed: an item of that type can never have `handleAction` dispatched to it, so
 * its program is deleted rather than stored where nothing would read it. The flag is
 * kept from the `actions-field.ts` signature this replaced, so the item definition's
 * call site is unchanged by the swap.
 */
export function writeProcessRef(w: EntryWriter, enabled = true): void {
    const id = enabled ? w.opt(PROCESS_FORM_KEY) : "";
    if (id) w.setRaw(PROCESS_STORE_KEY, id);
    else w.del(PROCESS_STORE_KEY);
}

/** The field spec for a definition's process reference. */
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
