import type { Opt } from "../../catalog.ts";
import type { EntryReader, EntryWriter } from "./types.ts";

export function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

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

export function parseIdList(text: string | undefined): string[] {
    if (!text) return [];
    return text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
}

export function formatIdList(ids: readonly string[] | undefined): string {
    return Array.isArray(ids) ? ids.join(", ") : "";
}

export const CUSTOM = "__custom__";

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

export function optOrCustom(form: Record<string, string>, selectKey: string, customKey: string) {
    const picked = (form[selectKey] ?? "").trim();
    return picked === CUSTOM ? (form[customKey] ?? "").trim() || undefined : picked || undefined;
}

export function readerFor(form: Record<string, string>): EntryReader {
    return {
        put(key, value) {
            if (value !== undefined) form[key] = value;
        },
        str: (v) => (typeof v === "string" ? v : undefined),
        num: (v) => typeof v === "number" && Number.isFinite(v) ? String(v) : undefined,
        json: (v) => v === undefined || v === null ? undefined : JSON.stringify(v, null, 2),
        jsonList: (v) => Array.isArray(v) ? (v as unknown[]).join(", ") || undefined : undefined,
    };
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

export const HEX = /^#[0-9a-fA-F]{6}$/;

export function hexToPacked(hex: string): number {
    return parseInt(hex.slice(1), 16) & 0xffffff;
}

export function packedToHex(n: number | undefined): string {
    if (typeof n !== "number" || !Number.isFinite(n)) return "";
    const rgb = n > 0xffffff ? (n >>> 0) & 0xffffff : n & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
}

export function writerFor(
    form: Record<string, string>,
    entry: Record<string, unknown>,
): EntryWriter {
    // One rule, four spellings: skip undefined, otherwise write as-is.
    const put = (key: string, v: unknown): void => {
        if (v !== undefined) entry[key] = v;
    };

    return {
        set: put,
        setStr: put,
        setNum: put,
        setBool: put,
        setRaw: put,

        del(key) {
            delete entry[key];
        },

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
                return undefined;
            }
        },
    };
}
