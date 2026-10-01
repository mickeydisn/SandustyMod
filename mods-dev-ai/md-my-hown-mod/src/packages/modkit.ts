/**
 * Minimal local copy of @sandmd/modkit helpers used by this mod.
 * Keeps the mod self-contained (no workspace dependency required at runtime).
 *
 * ## The host handle
 *
 * This file used to read the host four times on its own — three
 * `(globalThis as unknown as {sandkit}).sandkit?.api` and one
 * `(globalThis as any).sandkit?.state?.store`. That was a fourth copy of the
 * resolution order, and unlike `mysandkit.ts`'s it **only** consulted
 * `globalThis`. Per the probe recorded in `handler/core/types.ts`, the game
 * evaluates a mod as `new Function("__sandkit", …)`, so the host is a
 * **parameter in the mod's scope** and `globalThis.sandkit` is `undefined`
 * there:
 *
 * ```
 * scoped=object scoped.api=object globalThis.sandkit=undefined
 * ```
 *
 * So these reads returned `undefined` in the real game and only worked in tests,
 * which set a global. Every setting came back at its default, `onChange` never
 * subscribed, and the disable-cleanup path silently skipped — with the guards
 * downstream treating "unreadable" as "safe to proceed". All four now go
 * through `packages/mysandkit.ts`, the one place that knows the resolution order.
 */
import { api } from "./mysandkit.ts";

export type SettingDef =
    | { type: "boolean"; default: boolean }
    | { type: "number"; default: number; min?: number; max?: number }
    | { type: "string"; default: string };

export type SettingsSchema = Record<string, SettingDef>;

type ParsedSettings<S extends SettingsSchema> = {
    [K in keyof S]: S[K] extends { type: "boolean" } ? boolean
        : S[K] extends { type: "number" } ? number
        : S[K] extends { type: "string" } ? string
        : unknown;
};

function parseValue(def: SettingDef, raw: unknown): unknown {
    if (raw === undefined || raw === null) return def.default;
    switch (def.type) {
        case "boolean":
            if (typeof raw === "boolean") return raw;
            if (raw === "true" || raw === 1 || raw === "1") return true;
            if (raw === "false" || raw === 0 || raw === "0") return false;
            return def.default;
        case "number": {
            const n = typeof raw === "number" ? raw : Number(raw);
            if (!Number.isFinite(n)) return def.default;
            let v = n;
            if (def.min !== undefined) v = Math.max(def.min, v);
            if (def.max !== undefined) v = Math.min(def.max, v);
            return v;
        }
        case "string":
            return typeof raw === "string" ? raw : String(raw ?? def.default);
        default:
            // Unreachable for the current SettingDef union, but keeps the
            // signature total if another variant is added later.
            return (def as { default?: unknown }).default;
    }
}

export function readSettings<S extends SettingsSchema>(
    modId: string,
    schema: S,
): ParsedSettings<S> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
        const def = schema[key];
        // `settings.get(fieldId)` takes ONE argument and `FieldId` is any
        // string, so the settings field is named `"<modId>.<key>"`. Passing
        // `(modId, key)` looked right — it mirrors `storage.get` — but the
        // second argument is ignored and the first is read as a field named
        // after the mod id alone, which never exists. It only ever worked
        // because this second call corrected it.
        let raw = api.settings.get(`${modId}.${key}`);
        if (raw === undefined) raw = api.settings.get(key);
        out[key] = parseValue(def, raw);
    }
    return out as ParsedSettings<S>;
}

/**
 * The raw value of one setting field, or `undefined` when it cannot be read.
 *
 * `readSettings` cannot be used for this because it *defaults* every field, so
 * "the player set this to false" and "we could not read it" arrive as the same
 * `false`. Anything that decides whether to **destroy** stored data needs those
 * two kept apart, so it reads through here instead.
 */
export function readSettingRaw(modId: string, key: string): unknown {
    // The engine namespaces a mod's fields by its `modinfo.json` id, so this is
    // `"<modId>.<key>"`. The bare `key` is a *global* field belonging to no mod,
    // and reading it here would let an unrelated setting decide this mod's fate.
    return api.settings.get(`${modId}.${key}`);
}

export function onSettingsChange<S extends SettingsSchema>(
    modId: string,
    schema: S,
    cb: (cfg: ParsedSettings<S>) => void,
): () => void {
    // `settings.onChange(callback)` takes ONE argument. Calling it as
    // `onChange(modId, callback)` passed the mod id *as the callback*, so
    // the engine either threw on subscribe or threw when it later invoked
    // the string — and the `catch` below turned that into a silent no-op.
    // The subscription has therefore never worked; the callback reads
    // through `readSettings`, so the values argument is unused.
    const unsub = api.settings.onChange(() => {
        cb(readSettings(modId, schema));
    });
    return unsub ?? (() => {});
}

export function safe(fn: () => void): void {
    try {
        fn();
    } catch (e) {
        console.error("[modkit] safe() error", e);
    }
}

/** Lightweight cleanup: best-effort prune of buildings/items prefixed by modId. */
export function runCleanup(modId: string, reason: string): void {
    console.log(`[modkit] runCleanup ${modId} (${reason})`);
    const state = api.state.store;
    if (!state) return;
    // buildings unlocks
    const buildings = state.player?.buildings;
    if (buildings && typeof buildings === "object") {
        for (const k of Object.keys(buildings)) {
            if (k.startsWith(modId)) delete buildings[k];
        }
    }
    // inventory items
    const inv = state.player?.inventory;
    if (Array.isArray(inv)) {
        for (let i = inv.length - 1; i >= 0; i--) {
            const id = inv[i]?.id ?? inv[i]?.itemId;
            if (typeof id === "string" && id.startsWith(modId)) inv.splice(i, 1);
        }
    }
}

export function runDisableCleanup(
    modId: string,
    reason: string,
    storageKeys: readonly string[],
): void {
    runCleanup(modId, reason);
    wipeModStorage(modId, storageKeys);
}

export function wipeModStorage(modId: string, keys: readonly string[]): void {
    // `ensureFor`/`removeFor` rather than the `MOD_ID`-bound pair: the caller
    // names the mod, and silently substituting this mod's id here would wipe the
    // wrong keys.
    api.storage.ensureFor(modId);
    for (const k of keys) {
        api.storage.removeFor(modId, k);
    }
}
