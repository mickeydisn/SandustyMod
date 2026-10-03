import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const sprites = {
    load(id: string, path: string, options?: Record<string, unknown>): unknown {
        try {
            return g()?.api?.sprites?.load?.(id, path, options ?? {});
        } catch (e) {
            console.warn(`${LOG} sprites.load failed`, id, e);
            return undefined;
        }
    },
    loadFromMod(id: string, path: string, options?: Record<string, unknown>): unknown {
        try {
            return g()?.api?.sprites?.loadFromMod?.(id, path, options ?? {});
        } catch (e) {
            console.warn(`${LOG} sprites.loadFromMod failed`, id, e);
            return undefined;
        }
    },

    raw(): Record<string, any> | undefined {
        try {
            return g()?.api?.sprites as Record<string, any> | undefined;
        } catch (e) {
            console.warn(`${LOG} sprites namespace unavailable`, e);
            return undefined;
        }
    },

    namespace(): string | undefined {
        try {
            return g()?.api?.sprites?.namespace?.() as string | undefined;
        } catch (e) {
            console.warn(`${LOG} sprites.namespace failed`, e);
            return undefined;
        }
    },

    getRegistered(): string[] {
        try {
            return g()?.api?.sprites?.getRegistered?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} sprites.getRegistered failed`, e);
            return [];
        }
    },

    getLoaded(): string[] {
        try {
            return g()?.api?.sprites?.getLoaded?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} sprites.getLoaded failed`, e);
            return [];
        }
    },
    getAll(): string[] {
        try {
            return g()?.api?.sprites?.getAll?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} sprites.getAll failed`, e);
            return [];
        }
    },
    list(): string[] {
        try {
            return g()?.api?.sprites?.list?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} sprites.list failed`, e);
            return [];
        }
    },
};
