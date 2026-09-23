/**
 * Typed reader for the `configSchema` a mod declares in its `modinfo.json`.
 *
 * The schema is what builds the settings UI; `api.settings` stores the values
 * the player picked. This module maps those values back to a typed object so
 * mod code never has to parse raw host payloads.
 */
import "@sandmd/sandkit";
import { safe } from "./safe.ts";

/** One `configSchema` field — mirrors the matching entry in `modinfo.json`. */
export type SettingField =
    | { type: "boolean"; default: boolean }
    | { type: "number"; default: number; min?: number; max?: number }
    | { type: "string"; default: string };

/** A mod's whole `configSchema`. */
export type SettingsSchema = Record<string, SettingField>;

/** The typed values a schema produces, e.g. `{ enabled: boolean }`. */
export type SettingsValues<S extends SettingsSchema> = {
    -readonly [K in keyof S]: S[K] extends { type: "boolean" } ? boolean
        : S[K] extends { type: "number" } ? number
        : S[K] extends { type: "string" } ? string
        : never;
};

/** Raw lookup: the plain field name first, then the `<modId>.<name>` fallback. */
function readRaw(modId: string, name: string): unknown {
    const direct = safe(() => sandkit.api.settings.get(name));
    if (direct !== undefined && direct !== null) return direct;
    return safe(() => sandkit.api.settings.get(`${modId}.${name}`));
}

function readBoolean(modId: string, name: string, fallback: boolean): boolean {
    const raw = readRaw(modId, name);
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === 1) return true;
    if (raw === "false" || raw === 0) return false;
    return fallback;
}

function readNumber(
    modId: string,
    name: string,
    fallback: number,
    min?: number,
    max?: number,
): number {
    const raw = readRaw(modId, name);
    if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
    const lo = min ?? Number.NEGATIVE_INFINITY;
    const hi = max ?? Number.POSITIVE_INFINITY;
    return Math.min(hi, Math.max(lo, raw));
}

function readString(modId: string, name: string, fallback: string): string {
    const raw = readRaw(modId, name);
    return typeof raw === "string" ? raw : fallback;
}

function readField(modId: string, name: string, field: SettingField): boolean | number | string {
    switch (field.type) {
        case "boolean":
            return readBoolean(modId, name, field.default);
        case "number":
            return readNumber(modId, name, field.default, field.min, field.max);
        case "string":
            return readString(modId, name, field.default);
    }
}

/** Read every schema field, filling the gaps with each field's default. */
export function readSettings<S extends SettingsSchema>(
    modId: string,
    schema: S,
): SettingsValues<S> {
    const values: Record<string, boolean | number | string> = {};
    for (const [name, field] of Object.entries(schema)) {
        values[name] = readField(modId, name, field);
    }
    return values as SettingsValues<S>;
}

/**
 * Subscribe to `api.settings` changes. `cb` always receives the freshly parsed,
 * fully populated values, so partial host payloads never leak into mod code.
 */
export function onSettingsChange<S extends SettingsSchema>(
    modId: string,
    schema: S,
    cb: (values: SettingsValues<S>) => void,
): void {
    safe(() => sandkit.api.settings.onChange(() => cb(readSettings(modId, schema))));
}
