import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const terrains = {
    register(def: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.terrains;
            if (typeof ns?.register !== "function") return false;
            ns.register(def);
            return true;
        } catch (e) {
            console.error(`${LOG} terrains.register failed`, def.id, e);
            return false;
        }
    },
    getDataAtCell(x: number, y: number): Record<string, unknown> | null {
        try {
            return (g()?.api?.terrains?.getDataAtCell?.(x, y) as
                | Record<string, unknown>
                | null
                | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} terrains.getDataAtCell failed`, x, y, e);
            return null;
        }
    },

    getHitPointsAtCell(x: number, y: number): number | null {
        const data = terrains.getDataAtCell(x, y) as
            | { hitPoints?: unknown; hp?: unknown }
            | null;
        if (!data) return null;
        const hp = data.hitPoints ?? data.hp;
        return typeof hp === "number" ? hp : null;
    },

    getTypeAtCell(x: number, y: number): number | null {
        try {
            return g()?.api?.terrains?.getTypeAtCell?.(x, y) ?? null;
        } catch (e) {
            console.warn(`${LOG} terrains.getTypeAtCell failed`, x, y, e);
            return null;
        }
    },

    isAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.terrains?.isAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.isAtCell failed`, x, y, e);
            return false;
        }
    },

    isTypeAtCell(x: number, y: number, id: string | number): boolean {
        try {
            return g()?.api?.terrains?.isTypeAtCell?.(x, y, id) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.isTypeAtCell failed`, x, y, e);
            return false;
        }
    },
    isCellIdTerrain(cellId: unknown): boolean {
        try {
            return g()?.api?.terrains?.isCellIdTerrain?.(cellId) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.isCellIdTerrain failed`, e);
            return false;
        }
    },

    damageAtCell(x: number, y: number, damage: number): boolean {
        try {
            const ns = g()?.api?.terrains;
            if (typeof ns?.damageAtCell !== "function") return false;
            ns.damageAtCell(x, y, damage);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.damageAtCell failed`, x, y, e);
            return false;
        }
    },

    setHitPointsAtCell(x: number, y: number, hitPoints: number): boolean {
        try {
            const ns = g()?.api?.terrains;
            if (typeof ns?.setHitPointsAtCell !== "function") return false;
            return ns.setHitPointsAtCell(x, y, hitPoints) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.setHitPointsAtCell failed`, x, y, e);
            return false;
        }
    },

    getTypeById(id: string): number | null {
        try {
            return g()?.api?.terrains?.getTypeById?.(id) ?? null;
        } catch (e) {
            console.warn(`${LOG} terrains.getTypeById failed`, id, e);
            return null;
        }
    },
    updateDefinition(idOrType: string | number, partial: Record<string, unknown>): void {
        try {
            g()?.api?.terrains?.updateDefinition?.(idOrType, partial);
        } catch (e) {
            console.error(`${LOG} terrains.updateDefinition failed`, idOrType, e);
        }
    },

    getIdByType(t: number): string | undefined {
        try {
            return g()?.api?.terrains?.getIdByType?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} terrains.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getDefinitionByType(t: number): Record<string, unknown> | undefined {
        try {
            return g()?.api?.terrains?.getDefinitionByType?.(t) as
                | Record<string, unknown>
                | undefined;
        } catch (e) {
            console.warn(`${LOG} terrains.getDefinitionByType failed`, t, e);
            return undefined;
        }
    },
};
