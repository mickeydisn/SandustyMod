/**
 * The **data fields** an element or a structure carries per instance.
 *
 * Both objects have the same *idea* — a per-instance scratch space a process can
 * read and write — and two completely different *engines* for it. That is why
 * this is one module with two codecs rather than one shared shape: the panel
 * gives the author a list either way, and the difference is in what the list
 * means and what it may contain.
 *
 * ## Element — four numbered slots, and a name that is only a label
 *
 * `defaultDataFields` is `{ field1 … field4 }` and the runtime API is
 * `getDataFieldAtCell(x, y, n)` / `setDataFieldAtCell(x, y, n, value)`. A cell
 * has **four numeric slots, numbered, and that is all** — there is no storage for
 * a fifth, and no way to name one, because `n` is a number the engine passes
 * straight through.
 *
 * So a row is `{ name, slot, default }` where `name` is the author's label and
 * **is never sent to the engine**. It exists so "slot 2, holding the temperature"
 * can be written as `temperature` in the list and `slot 2` in the process. Two
 * rows may not share a slot, and a slot above 4 is refused.
 *
 * ## Structure — a real object with real keys
 *
 * `defaultData` is a free `Record<string, unknown>`, deep-cloned per instance,
 * and the runtime API takes the key by name (`structureData` /
 * `setStructureData`). So a row is `{ key, type, default }`, and `key` **is** the
 * key the engine stores.
 *
 * `type` is recorded, not enforced. `defaultData` legitimately holds shapes a
 * typed list cannot express — a nested object, an array — so the list is the
 * readable way to author the flat majority and the JSON box stays the escape
 * hatch. That is why structure keeps one and element does not: an element slot is
 * a single number, and there is no shape for a box to express.
 *
 * Ground truth: `doc/doc-tech/05-elements-api-reference.md` §5,
 * `doc/doc-tech/08-registering-elements.md`, `doc/doc-tech/09-structures-register.md` §2.
 */

/** A value a data field can hold. Matches what each engine actually stores. */
export type DataFieldValue = number | boolean | string;

/** One authored element field: a label, the slot it occupies, and its seed. */
export interface ElementDataField {
    /** The author's name for it. Panel-only — the engine never sees this. */
    name: string;
    /** 1–4. The `n` in `getDataFieldAtCell(x, y, n)`. */
    slot: number;
    default: number;
}

/** One authored structure field: a real key, its type, and its seed. */
export interface StructureDataField {
    key: string;
    type: "number" | "bool" | "string";
    default: DataFieldValue;
}

/** The engine has exactly this many element data slots. Not a preference. */
export const ELEMENT_DATA_SLOTS = 4 as const;

/** The engine's own key for a slot: `field1` … `field4`. */
export function elementSlotKey(slot: number): string {
    return `field${slot}`;
}

/** Why a list of fields cannot be used as written. */
export interface DataFieldProblem {
    /** 0-based index of the offending row, or -1 for a list-wide problem. */
    row: number;
    reason: string;
}

/**
 * The list → `{ fieldN: value }` the engine registers.
 *
 * Also the validator, deliberately: it is the only place that knows the two hard
 * limits (four slots, no duplicates) and the two soft ones (a whole number, a
 * name to show). One function means the panel cannot accept a list the register
 * step would then have to reject.
 */
export function elementFieldsToRecord(
    rows: readonly ElementDataField[],
): { record: Record<string, number>; problems: DataFieldProblem[] } {
    const record: Record<string, number> = {};
    const problems: DataFieldProblem[] = [];
    const seen = new Map<number, string>();

    for (const [row, f] of (rows ?? []).entries()) {
        const label = f.name?.trim() || `slot ${f.slot}`;
        const slot = Number(f.slot);
        if (!Number.isInteger(slot) || slot < 1 || slot > ELEMENT_DATA_SLOTS) {
            problems.push({ row, reason: `slot must be 1–${ELEMENT_DATA_SLOTS}` });
            continue;
        }
        const first = seen.get(slot);
        if (first) {
            // Two names for one slot is the failure this is here to prevent: the
            // engine keeps whichever was written last, and the other's value would
            // read as the wrong thing forever.
            problems.push({
                row,
                reason: `slot ${slot} is already used by "${first}" — a slot holds one number`,
            });
            continue;
        }
        const value = Number(f.default);
        if (!Number.isFinite(value)) {
            problems.push({ row, reason: "default must be a number" });
            continue;
        }
        if (!Number.isInteger(value)) {
            // The slot is a number the engine stores as given, so 0.5 would come
            // back as something else and the author would never know what.
            problems.push({ row, reason: "default must be a whole number" });
            continue;
        }
        seen.set(slot, label);
        record[elementSlotKey(slot)] = value;
    }
    return { record, problems };
}

/**
 * `{ fieldN: value }` → the list the form shows.
 *
 * Rows are unnamed on the way back, because the engine never stored the name.
 * That is the reverse mapping being honestly lossy rather than inventing a label:
 * a hand-edited config still shows its four slots rather than appearing empty.
 */
export function elementRecordToFields(raw: unknown): ElementDataField[] {
    if (typeof raw !== "object" || raw === null) return [];
    const out: ElementDataField[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const m = /^field([1-4])$/.exec(key);
        if (!m) continue;
        const n = Number(value);
        out.push({ name: "", slot: Number(m[1]), default: Number.isFinite(n) ? n : 0 });
    }
    return out.sort((a, b) => a.slot - b.slot);
}

/**
 * The list → the `defaultData` object a structure registers.
 *
 * No key validation beyond "not empty": `defaultData` is stored verbatim, so a key
 * that is legal JSON is a legal key, and inventing a narrower rule would reject
 * names the engine accepts.
 */
export function structureFieldsToRecord(
    rows: readonly StructureDataField[],
): { record: Record<string, DataFieldValue>; problems: DataFieldProblem[] } {
    const record: Record<string, DataFieldValue> = {};
    const problems: DataFieldProblem[] = [];
    for (const [row, f] of (rows ?? []).entries()) {
        const key = f.key?.trim();
        if (!key) {
            problems.push({ row, reason: "a key is required" });
            continue;
        }
        if (key in record) {
            problems.push({ row, reason: `"${key}" is declared twice` });
            continue;
        }
        record[key] = coerceDataValue(f.type, f.default);
    }
    return { record, problems };
}

/**
 * A seed forced into the shape its type promises.
 *
 * The list is stored as JSON, so `true` and `"true"` are the same text and the
 * engine would store whichever arrived. Coercing here is what makes a bool field
 * read back as a bool rather than as a truthy string.
 */
export function coerceDataValue(
    type: StructureDataField["type"],
    raw: unknown,
): DataFieldValue {
    if (type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "bool") {
        if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
        return Boolean(raw);
    }
    return raw == null ? "" : String(raw);
}

/**
 * `defaultData` → the list, inferring each type from the value that is there.
 *
 * A value the list cannot represent — a nested object, an array — contributes
 * **no row** rather than one typed by its runtime shape. That is the one rule
 * here that is not mechanical, and it exists because the alternative is a lie the
 * author would not catch: an object typed as `string` would be given
 * `"[object Object]"` as its default, and saving the list would replace a real
 * value in `defaultData` with that text. Losing the row keeps the value in the box
 * above, which is the only place it is honestly editable.
 */
export function structureRecordToFields(raw: unknown): StructureDataField[] {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const out: StructureDataField[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value !== null && typeof value === "object") continue;
        out.push({
            key,
            type: typeof value === "number"
                ? "number"
                : typeof value === "boolean"
                ? "bool"
                : "string",
            // `null` is a legal thing to store and `typeof null` is `"object"`, so
            // it is caught above and lands here as the string it is usually meant
            // to be. Anything else non-primitive is already gone.
            default: (value ?? "") as DataFieldValue,
        });
    }
    return out;
}
