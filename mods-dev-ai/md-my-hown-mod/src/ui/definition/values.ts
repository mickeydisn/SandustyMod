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
import type { Opt } from "../../catalog.ts";
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

/** The sentinel a select carries to mean "the companion text box holds it". */
export const CUSTOM = "__custom__";

/**
 * Load a "picker or custom text" pair into a form.
 *
 * Several fields store a free string in the engine but are worth a picker in the
 * form, because the values already in use are enumerable even though the type is
 * not — a tech's `currencyType` or `branch`, an upgrade's `categoryId`. The
 * cost of a picker is that a value it does not list needs somewhere to go, and
 * dropping it silently would lose a hand-edited config on the next save.
 *
 * So an unlisted value switches the select to `__custom__` and moves into the
 * companion box, which is a control that always exists. The pair is read back by
 * `optOrCustom`.
 *
 * Lives here rather than in a definition because a tech, an unlock node and an
 * upgrade all use it, and the read and the write have to agree on the sentinel.
 */
export function putCustomOrSelect(
    put: (key: string, value: string) => void,
    value: string | undefined,
    selectKey: string,
    customKey: string,
    options: Opt[],
): void {
    const v = (value ?? "").trim();
    if (!v) return;
    if (options.some((o) => o.value === v)) put(selectKey, v);
    else {
        put(selectKey, CUSTOM);
        put(customKey, v);
    }
}

/**
 * Read a "picker or custom text" pair back out: the companion box when the
 * select says `__custom__`, otherwise the selected value.
 *
 * The inverse of `putCustomOrSelect`, and the reason it is exported beside it —
 * a reader that wrote the sentinel but a writer that did not understand it
 * would persist the literal string `__custom__` as the stored value.
 */
export function optOrCustom(form: Record<string, string>, selectKey: string, customKey: string) {
    const picked = (form[selectKey] ?? "").trim();
    return picked === CUSTOM ? (form[customKey] ?? "").trim() || undefined : picked || undefined;
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
        num: (v) => typeof v === "number" && Number.isFinite(v) ? String(v) : undefined,
        json: (v) => v === undefined || v === null ? undefined : JSON.stringify(v, null, 2),
        jsonList: (v) => Array.isArray(v) ? (v as unknown[]).join(", ") || undefined : undefined,
    };
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * The one `#rrggbb` pattern, shared.
 *
 * The generic `color` field rule and every definition that packs a colour
 * validate against this, so it is stated once: a second copy would let the
 * validator and the widget disagree about what a colour is, and the symptom
 * would be a colour the picker accepts and the validator then rejects.
 */
export const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * `#rrggbb` → the packed `0xRRGGBB` the engine stores for `metaColor`.
 *
 * The `& 0xffffff` is load-bearing: a hand-edited config can hold a value wider
 * than 24 bits, and masking is what makes it display as a 6-digit colour again
 * rather than a 7-digit one the `color` rule would then reject — turning a
 * readable stored value into a field that cannot be saved.
 */
export function hexToPacked(hex: string): number {
    return parseInt(hex.slice(1), 16) & 0xffffff;
}

/**
 * Packed `0xRRGGBB` → `#rrggbb`, or `""` when the entry has no map colour.
 *
 * Handles both a genuine 32-bit unsigned value (`0xff0000ff`, from a config that
 * packed with `<< 24`) and a signed one, by taking the low 24 bits either way.
 * Without the mask, `0x1000000` renders as `#1000000` — seven digits, which
 * `HEX` does not match, so the field fails its own validation and the entry can
 * no longer be saved.
 */
export function packedToHex(n: number | undefined): string {
    if (typeof n !== "number" || !Number.isFinite(n)) return "";
    const rgb = n > 0xffffff ? (n >>> 0) & 0xffffff : n & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
}

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
        // Distinct from the setters above, which skip an `undefined` write and
        // leave the old value in place. Removing is the migration's job: a
        // process that has been rewritten as `actions` must not also keep the
        // `handlerKey` it replaced.
        del(key) {
            delete entry[key];
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
