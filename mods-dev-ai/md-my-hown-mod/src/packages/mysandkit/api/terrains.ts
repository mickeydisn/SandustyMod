import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import type {
    TerrainDataAtCell,
    TerrainDefinition,
    TerrainId,
    TerrainRef,
    TerrainType,
    TerrainWriteOptions,
} from "../host-types/domain.d.ts";
import type { CellId } from "../host-types/shared.d.ts";

export const terrains = {
    register(def: TerrainDefinition): { cellType?: TerrainType } | undefined {
        try {
            const ns = g()?.api?.terrains;
            if (typeof ns?.register !== "function") return undefined;
            return ns.register(def);
        } catch (e) {
            console.error(`${LOG} terrains.register failed`, def.id, e);
            return undefined;
        }
    },
    getDataAtCell(x: number, y: number): TerrainDataAtCell | null {
        try {
            return (g()?.api?.terrains?.getDataAtCell?.(x, y) as
                | TerrainDataAtCell
                | null
                | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} terrains.getDataAtCell failed`, x, y, e);
            return null;
        }
    },

    /**
     * Current hit points, or null when the cell has none.
     *
     * The `number` check is deliberate: the host is typed, but a malformed
     * payload should still yield null rather than leaking a non-number.
     */
    getHitPointsAtCell(x: number, y: number): number | null {
        const data = terrains.getDataAtCell(x, y);
        const hp = data?.hitPoints ?? data?.hp;
        return typeof hp === "number" ? hp : null;
    },

    getTypeAtCell(x: number, y: number): TerrainType | null {
        try {
            return (g()?.api?.terrains?.getTypeAtCell?.(x, y) as TerrainType | null) ?? null;
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

    isTypeAtCell(x: number, y: number, id: TerrainRef): boolean {
        try {
            return g()?.api?.terrains?.isTypeAtCell?.(x, y, id) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.isTypeAtCell failed`, x, y, e);
            return false;
        }
    },
    isCellIdTerrain(cellId: CellId): boolean {
        try {
            return g()?.api?.terrains?.isCellIdTerrain?.(cellId) === true;
        } catch (e) {
            console.warn(`${LOG} terrains.isCellIdTerrain failed`, e);
            return false;
        }
    },

    /**
     * Create terrain at a cell, deferred to the next simulation tick.
     *
     * Unlike elements, the terrain facade is a straight pass-through
     * (`extra-mod-runtime.js` 2252), so a string id is **not** resolved here —
     * callers must pass a numeric handle.
     */
    createAtCell(
        x: number,
        y: number,
        type: TerrainType,
        options?: TerrainWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.createAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, type, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.createAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Create terrain, but only if the cell is still empty when the tick runs. */
    createAtCellWhenIdle(
        x: number,
        y: number,
        type: TerrainType,
        options?: TerrainWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.createAtCellWhenIdle ?? ns?.createAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, type, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.createAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Replace the terrain at a cell. Numeric handle only, as with create. */
    replaceAtCell(
        x: number,
        y: number,
        type: TerrainType,
        options?: TerrainWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.replaceAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, type, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.replaceAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Replace terrain, guarded on the cell id being unchanged. */
    replaceAtCellWhenIdle(
        x: number,
        y: number,
        type: TerrainType,
        options?: TerrainWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.replaceAtCellWhenIdle ?? ns?.replaceAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, type, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.replaceAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Remove terrain from a cell. */
    removeAtCell(x: number, y: number, options?: TerrainWriteOptions): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.removeAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.removeAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Remove terrain, guarded on the cell id being unchanged. */
    removeAtCellWhenIdle(x: number, y: number, options?: TerrainWriteOptions): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.removeAtCellWhenIdle ?? ns?.removeAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.removeAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /**
     * Melt the terrain at a cell, turning it into its liquid output.
     *
     * Unlike the other terrain writes this one is *immediate*, not deferred to
     * the next tick (`extra-mod-runtime.js` 2322).
     */
    meltAtCell(x: number, y: number): boolean {
        try {
            const ns = g()?.api?.terrains;
            if (typeof ns?.meltAtCell !== "function") return false;
            ns.meltAtCell(x, y);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.meltAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Alias of {@link getTypeById}; identical resolution, different name. */
    getTypeFromId(id: TerrainId): TerrainType | null {
        return terrains.getTypeById(id);
    },

    /** Set terrain hit points, guarded on the cell id being unchanged. */
    setHpAtCellWhenIdle(x: number, y: number, hitPoints: number): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.setHpAtCellWhenIdle ?? ns?.setHitPointsAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, hitPoints);
            return true;
        } catch (e) {
            console.warn(`${LOG} terrains.setHpAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Alias of {@link setHitPointsAtCell}. */
    setHpAtCell(x: number, y: number, hitPoints: number): boolean {
        return terrains.setHitPointsAtCell(x, y, hitPoints);
    },

    /** Set terrain hit points, guarded on the cell id being unchanged. */
    setHitPointsAtCellWhenIdle(x: number, y: number, hitPoints: number): boolean {
        try {
            const ns = g()?.api?.terrains;
            const fn = ns?.setHitPointsAtCellWhenIdle ??
                ns?.setHpAtCellWhenIdle ??
                ns?.setHitPointsAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, hitPoints);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} terrains.setHitPointsAtCellWhenIdle failed`,
                x,
                y,
                e,
            );
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

    getTypeById(id: TerrainId): TerrainType | null {
        try {
            return (g()?.api?.terrains?.getTypeById?.(id) as TerrainType | null) ?? null;
        } catch (e) {
            console.warn(`${LOG} terrains.getTypeById failed`, id, e);
            return null;
        }
    },
    updateDefinition(ref: TerrainRef, partial: Partial<TerrainDefinition>): void {
        try {
            g()?.api?.terrains?.updateDefinition?.(ref, partial);
        } catch (e) {
            console.error(`${LOG} terrains.updateDefinition failed`, ref, e);
        }
    },

    getIdByType(t: TerrainType): TerrainId | undefined {
        try {
            return g()?.api?.terrains?.getIdByType?.(t) as TerrainId | undefined;
        } catch (e) {
            console.warn(`${LOG} terrains.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getDefinitionByType(t: TerrainType): TerrainDefinition | undefined {
        try {
            return g()?.api?.terrains?.getDefinitionByType?.(t) as
                | TerrainDefinition
                | undefined;
        } catch (e) {
            console.warn(`${LOG} terrains.getDefinitionByType failed`, t, e);
            return undefined;
        }
    },
};
