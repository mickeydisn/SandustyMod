/**
 * Form ⇄ entry value codecs, shared by every object definition.
 *
 * These are the answers to questions that come up identically in all 24 tabs —
 * "what does an empty control mean", "how does a stored `42` reach a text box",
 * "is this a list of ids or a list of words". A definition that answered them
 * locally would answer them slightly differently each time, and the difference
 * would only surface on an entry that was never hand-written: a `NaN` density
 * that round-trips to `"NaN"`, an empty list saved as `[""]` and read back as
 * one blank id.
 *
 * So they live here, and a definition is handed them rather than writing its own.
 */
import type { EntryReader, EntryWriter } from "./types.ts";

/** Parse JSON text, returning undefined instead of throwing. */
export function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** Parse a JSON object, or undefined. Never throws — `when` runs on every render. */
export function parseObjectOrUndefined(
    raw: string | undefined,
): Record<string, unknown> | undefined {
    if (!raw?.trim()) return undefined;
    try {
        const v = JSON.parse(raw);
        return v && typeof v === "object" && !Array.isArray(v)
            ? v as Record<string, unknown>
            : undefined;
    } catch {
        return undefined;
    }
}

/** Parse a comma/space separated id list ("a, b ,c") into trimmed, non-empty ids. */
export function parseIdList(text: string | undefined): string[] {
    if (!text) return [];
    return text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
}

/** Join ids back into the comma-separated form representation. */
export function formatIdList(ids: readonly string[] | undefined): string {
    return Array.isArray(ids) ? ids.join(", ") : "";
}

/** The reader a definition is given, writing into one form. */
export function readerFor(form: Record<string, string>): EntryReader {
    return {
        put(key, value) {
            // `undefined` means "this key is not set on the entry", which is not
            // the same as "set it to nothing" — the field's own default stays.
            if (value !== undefined) form[key] = value;
        },
        str: (v) => (typeof v === "string" ? v : undefined),
        num: (v) =>
            typeof v === "number" && Number.isFinite(v) ? String(v) : undefined,
        json: (v) =>
            v === undefined || v === null ? undefined : JSON.stringify(v, null, 2),
    };
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** The writer a definition is given, reading one form into one entry. */
export function writerFor(
    form: Record<string, string>,
    entry: Record<string, unknown>,
): EntryWriter {
    return {
        setStr(key, v) {
            if (v !== undefined) entry[key] = v;
        },
        setNum(key, v) {
            if (v !== undefined) entry[key] = v;
        },
        setBool(key, v) {
            if (v !== undefined) entry[key] = v;
        },
        setRaw(key, v) {
            if (v !== undefined) entry[key] = v;
        },
        // An empty control is "not set", not `""`. This is what makes clearing a
        // field remove the key on save instead of writing a blank the engine
        // would then read as a real value.
        opt(key) {
            const v = (form[key] ?? "").trim();
            return v === "" ? undefined : v;
        },
        optNum(key) {
            const v = (form[key] ?? "").trim();
            if (v === "" || !NUMERIC.test(v)) return undefined;
            return Number(v);
        },
        optBool(key) {
            const v = (form[key] ?? "").trim();
            if (v === "") return undefined;
            return v === "true";
        },
        optJson<T>(key: string): T | undefined {
            const v = (form[key] ?? "").trim();
            if (v === "") return undefined;
            try {
                return JSON.parse(v) as T;
            } catch {
                return undefined; // validation already blocked Save
            }
        },
    };
}
