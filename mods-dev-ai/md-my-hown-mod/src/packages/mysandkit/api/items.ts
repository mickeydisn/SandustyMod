import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type ItemConfig } from "../types.ts";
import { normalizeItem } from "../internal/normalize.ts";

export const items = {
    register(def: ItemConfig): void {
        try {
            g()?.api?.items?.register?.(normalizeItem(def));
        } catch (e) {
            console.error(`${LOG} items.register failed`, def.id, e);
        }
    },

    updateDefinition(idOrType: string | number, partial: Record<string, unknown>): void {
        try {
            g()?.api?.items?.updateDefinition?.(idOrType, partial);
        } catch (e) {
            console.error(`${LOG} items.updateDefinition failed`, idOrType, e);
        }
    },

    getRegisteredIds(): string[] {
        try {
            return (g()?.api?.items?.getRegisteredIds?.() ?? []) as string[];
        } catch (e) {
            console.warn(`${LOG} items.getRegisteredIds failed`, e);
            return [];
        }
    },

    getDefinitionById(id: string): Record<string, unknown> | undefined {
        try {
            return (g()?.api?.items?.getDefinitionById?.(id) ?? undefined) as
                | Record<string, unknown>
                | undefined;
        } catch (e) {
            console.warn(`${LOG} items.getDefinitionById failed`, id, e);
            return undefined;
        }
    },

    getRegistered(): Record<string, unknown>[] {
        try {
            return g()?.api?.items?.getRegistered?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} items.getRegistered failed`, e);
            return [];
        }
    },
    getAll(): Record<string, unknown>[] {
        try {
            return g()?.api?.items?.getAll?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} items.getAll failed`, e);
            return [];
        }
    },
    list(): Record<string, unknown>[] {
        try {
            return g()?.api?.items?.list?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} items.list failed`, e);
            return [];
        }
    },
};
