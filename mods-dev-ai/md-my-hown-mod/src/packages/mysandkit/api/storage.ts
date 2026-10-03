import { g } from "../host.ts";
import { LOG, MOD_ID } from "../../../constants.ts";

export const storage = {
    ensure() {
        g()?.api?.storage?.ensure?.(MOD_ID);
    },
    get<T = unknown>(key: string, fallback?: T): T | undefined {
        try {
            g()?.api?.storage?.ensure?.(MOD_ID);
            const v = g()?.api?.storage?.get?.(MOD_ID, key);
            return (v === undefined || v === null) ? fallback : (v as T);
        } catch {
            return fallback;
        }
    },
    set(key: string, value: unknown) {
        try {
            g()?.api?.storage?.ensure?.(MOD_ID);
            g()?.api?.storage?.set?.(MOD_ID, key, value);
        } catch (e) {
            console.warn(`${LOG} storage.set failed`, key, e);
        }
    },
    remove(key: string) {
        try {
            g()?.api?.storage?.remove?.(MOD_ID, key);
        } catch {}
    },

    ensureFor(modId: string) {
        try {
            g()?.api?.storage?.ensure?.(modId);
        } catch (e) {
            console.warn(`${LOG} storage.ensureFor failed`, modId, e);
        }
    },
    removeFor(modId: string, key: string) {
        try {
            g()?.api?.storage?.remove?.(modId, key);
        } catch (e) {
            console.warn(`${LOG} storage.removeFor failed`, modId, key, e);
        }
    },
};
