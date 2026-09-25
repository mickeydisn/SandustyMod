declare const sandkit: any;
/**
 * Minimal local copy of @sandmd/modkit helpers used by this mod.
 * Keeps the mod self-contained (no workspace dependency required at runtime).
 */

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
            return def.default;
    }
}

export function readSettings<S extends SettingsSchema>(
    modId: string,
    schema: S,
): ParsedSettings<S> {
    const api = (globalThis as unknown as { sandkit: { api: any } }).sandkit?.api;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
        const def = schema[key];
        let raw: unknown;
        try {
            raw = api?.settings?.get?.(modId, key);
            if (raw === undefined) {
                // fallback dotted key
                raw = api?.settings?.get?.(`${modId}.${key}`);
            }
        } catch {
            raw = undefined;
        }
        out[key] = parseValue(def, raw);
    }
    return out as ParsedSettings<S>;
}

export function onSettingsChange<S extends SettingsSchema>(
    modId: string,
    schema: S,
    cb: (cfg: ParsedSettings<S>) => void,
): () => void {
    const api = (globalThis as unknown as { sandkit: { api: any } }).sandkit?.api;
    if (!api?.settings?.onChange) {
        return () => {};
    }
    try {
        const unsub = api.settings.onChange(modId, () => {
            cb(readSettings(modId, schema));
        });
        return typeof unsub === "function" ? unsub : () => {};
    } catch {
        return () => {};
    }
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
    try {
        const state = (globalThis as any).sandkit?.state?.store;
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
    } catch (e) {
        console.warn("[modkit] runCleanup partial failure", e);
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
    const api = ((typeof sandkit !== 'undefined' && sandkit) ? sandkit : (globalThis as any).sandkit)?.api;
    if (!api?.storage) return;
    try {
        api.storage.ensure?.(modId);
        for (const k of keys) {
            try {
                api.storage.remove?.(modId, k);
            } catch { /* ignore */ }
        }
    } catch (e) {
        console.warn("[modkit] wipeModStorage failed", e);
    }
}
