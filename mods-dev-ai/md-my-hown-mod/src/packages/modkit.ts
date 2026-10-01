
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
        
        
        
        
        
        
        let raw = api.settings.get(`${modId}.${key}`);
        if (raw === undefined) raw = api.settings.get(key);
        out[key] = parseValue(def, raw);
    }
    return out as ParsedSettings<S>;
}


export function readSettingRaw(modId: string, key: string): unknown {
    
    
    
    return api.settings.get(`${modId}.${key}`);
}

export function onSettingsChange<S extends SettingsSchema>(
    modId: string,
    schema: S,
    cb: (cfg: ParsedSettings<S>) => void,
): () => void {
    
    
    
    
    
    
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


export function runCleanup(modId: string, reason: string): void {
    console.log(`[modkit] runCleanup ${modId} (${reason})`);
    const state = api.state.store;
    if (!state) return;
    
    const buildings = state.player?.buildings;
    if (buildings && typeof buildings === "object") {
        for (const k of Object.keys(buildings)) {
            if (k.startsWith(modId)) delete buildings[k];
        }
    }
    
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
    
    
    
    api.storage.ensureFor(modId);
    for (const k of keys) {
        api.storage.removeFor(modId, k);
    }
}
