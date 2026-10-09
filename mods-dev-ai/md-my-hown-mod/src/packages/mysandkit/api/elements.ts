import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type ElementConfig } from "../types.ts";
import { normalizeElement } from "../internal/normalize.ts";
import type {
    ElementId,
    ElementInfoAtCell,
    ElementPhysicsState,
    ElementRef,
    ElementType,
    ElementWriteOptions,
    Interaction,
    MatterType,
} from "../host-types/domain.d.ts";
import type { CellId, Vector2 } from "../host-types/shared.d.ts";

/** Result of `elements.register`. */
export interface ElementRegistration {
    /** Assigned numeric element type. */
    elementType?: ElementType;
    [key: string]: unknown;
}

export const elements = {
    register(def: ElementConfig): ElementRegistration | undefined {
        try {
            return g()?.api?.elements?.register?.(normalizeElement(def));
        } catch (e) {
            console.error(`${LOG} elements.register failed`, def.id, e);
            return undefined;
        }
    },
    updateDefinition(ref: ElementRef, partial: Partial<ElementConfig>): void {
        try {
            g()?.api?.elements?.updateDefinition?.(ref, partial);
        } catch (e) {
            console.error(`${LOG} elements.updateDefinition failed`, e);
        }
    },
    addInteractionInfo(ref: ElementRef, interaction: Interaction): void {
        try {
            g()?.api?.elements?.addInteractionInfo?.(ref, interaction);
        } catch (e) {
            console.error(`${LOG} elements.addInteractionInfo failed`, e);
        }
    },

    addElementToDiscoveries(elementType: ElementType): void {
        try {
            const d = g()?.api?.discoveries;
            if (d?.addElement) d.addElement(elementType);
            else d?.addElementByType?.(elementType);
        } catch (e) {
            console.error(`${LOG} discoveries.addElement failed`, e);
        }
    },

    getTypeById(id: ElementId): ElementType | undefined {
        try {
            return g()?.api?.elements?.getTypeById?.(id) as ElementType | undefined;
        } catch {
            return undefined;
        }
    },

    getRegisteredTypes(): ElementType[] {
        try {
            return (g()?.api?.elements?.getRegisteredTypes?.() ?? []) as ElementType[];
        } catch (e) {
            console.warn(`${LOG} elements.getRegisteredTypes failed`, e);
            return [];
        }
    },

    getDefinitionByType(t: ElementType): ElementConfig | undefined {
        try {
            return g()?.api?.elements?.getDefinitionByType?.(t) as ElementConfig | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getDefinitionByType failed`, t, e);
            return undefined;
        }
    },

    getIdByType(t: ElementType): ElementId | undefined {
        try {
            return g()?.api?.elements?.getIdByType?.(t) as ElementId | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getNameByType(t: ElementType): string | undefined {
        try {
            return g()?.api?.elements?.getNameByType?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getNameByType failed`, t, e);
            return undefined;
        }
    },

    getResolvedTypeAtCell(x: number, y: number): ElementType | undefined {
        try {
            return g()?.api?.elements?.getResolvedTypeAtCell?.(x, y) as
                | ElementType
                | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getResolvedTypeAtCell failed`, x, y, e);
            return undefined;
        }
    },

    getTypeAtCell(x: number, y: number): ElementType | null {
        try {
            return (g()?.api?.elements?.getTypeAtCell?.(x, y) as ElementType | null) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.getTypeAtCell failed`, x, y, e);
            return null;
        }
    },

    /** @deprecated Host alias; prefer `getTypeById`. */
    getTypeFromId(id: ElementId): ElementType | null {
        try {
            return (g()?.api?.elements?.getTypeFromId?.(id) as ElementType | null) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.getTypeFromId failed`, id, e);
            return null;
        }
    },

    isTypeAtCell(x: number, y: number, ref: ElementRef): boolean {
        try {
            return g()?.api?.elements?.isTypeAtCell?.(x, y, ref) === true;
        } catch (e) {
            console.warn(`${LOG} elements.isTypeAtCell failed`, x, y, e);
            return false;
        }
    },

    setVelocityAtCell(x: number, y: number, velocity: Vector2): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.setVelocityAtCell !== "function") return false;
            ns.setVelocityAtCell(x, y, velocity);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setVelocityAtCell failed`, x, y, e);
            return false;
        }
    },

    addParticleVelocityAtCell(
        x: number,
        y: number,
        velocity: Vector2,
        maxSpeed?: number,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.addParticleVelocityAtCell !== "function") return false;
            if (maxSpeed) ns.addParticleVelocityAtCell(x, y, velocity, maxSpeed);
            else ns.addParticleVelocityAtCell(x, y, velocity);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.addParticleVelocityAtCell failed`, x, y, e);
            return false;
        }
    },

    setDurationAtCell(
        x: number,
        y: number,
        n: number,
        opts?: { updateMax?: boolean },
    ): boolean {
        try {
            const ns = g()?.api?.elements;

            if (typeof ns?.setDurationAtCell !== "function") return false;
            ns.setDurationAtCell(x, y, n, opts);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setDurationAtCell failed`, x, y, e);
            return false;
        }
    },

    /**
     * Create an element at a cell, resolving string ids.
     *
     * The facade maps a string id through `getElementTypeFromId` and defers to
     * the next simulation tick, only writing if the cell is still empty
     * (`extra-mod-runtime.js` 1318-1325).
     */
    createAtCell(
        x: number,
        y: number,
        ref: ElementRef,
        options?: ElementWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.createAtCell !== "function") return false;
            ns.createAtCell(x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.createAtCell failed`, x, y, e);
            return false;
        }
    },

    /**
     * Like {@link createAtCell} but guarded on a cell-id check, so it is a
     * no-op if the cell was replaced before the tick ran
     * (`extra-mod-runtime.js` 1327-1336).
     */
    createAtCellWhenIdle(
        x: number,
        y: number,
        ref: ElementRef,
        options?: ElementWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.createAtCellWhenIdle ?? ns?.createAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.createAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Replace the element at a cell; the facade resolves string ids. */
    replaceAtCell(
        x: number,
        y: number,
        ref: ElementRef,
        options?: ElementWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.replaceAtCell !== "function") return false;
            ns.replaceAtCell(x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.replaceAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Replace, guarded on the cell id being unchanged when the tick runs. */
    replaceAtCellWhenIdle(
        x: number,
        y: number,
        ref: ElementRef,
        options?: ElementWriteOptions,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.replaceAtCellWhenIdle ?? ns?.replaceAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.replaceAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /**
     * Resolved element type stored in a cell handle.
     *
     * Distinct from {@link getTypeAtCell}: reads the type recorded in the cell
     * id, so no coordinate pair is needed.
     */
    getResolvedTypeFromCellId(cellId: CellId): ElementType | null {
        try {
            return (g()?.api?.elements?.getResolvedTypeFromCellId?.(cellId) ??
                null) as ElementType | null;
        } catch (e) {
            console.warn(`${LOG} elements.getResolvedTypeFromCellId failed`, e);
            return null;
        }
    },

    /**
     * Element type plus particle linkage for a cell.
     *
     * `null` for a non-element cell, and also for a particle whose link index
     * is `<= 0`. For a particle, `elementType` is the *linked* type rather
     * than the particle type itself (`bundel.js` 33514-33535).
     */
    getInfoAtCell(x: number, y: number): ElementInfoAtCell | null {
        try {
            return (g()?.api?.elements?.getInfoAtCell?.(x, y) ??
                null) as ElementInfoAtCell | null;
        } catch (e) {
            console.warn(`${LOG} elements.getInfoAtCell failed`, x, y, e);
            return null;
        }
    },

    /** Matter type of the element at a cell, or null when empty. */
    getMatterTypeAtCell(x: number, y: number): MatterType | null {
        try {
            return (g()?.api?.elements?.getMatterTypeAtCell?.(x, y) ??
                null) as MatterType | null;
        } catch (e) {
            console.warn(`${LOG} elements.getMatterTypeAtCell failed`, x, y, e);
            return null;
        }
    },

    /**
     * Whether the element at a cell is in free-fall.
     *
     * False for an empty cell, not merely "no element"
     * (`extra-mod-runtime.js` 1316).
     */
    isFreeFallingAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.elements?.isFreeFallingAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} elements.isFreeFallingAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Recompute an element cell's colour from its current variant state. */
    refreshColorAtCell(x: number, y: number): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.refreshColorAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.refreshColorAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Recompute colour, guarded on the cell id being unchanged. */
    refreshColorAtCellWhenIdle(x: number, y: number): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.refreshColorAtCellWhenIdle ?? ns?.refreshColorAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.refreshColorAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /**
     * Apply a physics state to an element cell.
     *
     * Also reports chunk activity, and is a no-op when the cell holds no
     * element (`extra-mod-runtime.js` 1469-1474).
     */
    setPhysicsAtCell(x: number, y: number, physics: ElementPhysicsState): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.setPhysicsAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, physics);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setPhysicsAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Apply physics, guarded on the cell id being unchanged. */
    setPhysicsAtCellWhenIdle(x: number, y: number, physics: ElementPhysicsState): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.setPhysicsAtCellWhenIdle ?? ns?.setPhysicsAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, physics);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setPhysicsAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /**
     * Turn a particle back into the element it carries.
     *
     * This is the inverse of {@link convertToParticleAtCell}, not an alias for
     * it (`extra-mod-runtime.js` 1426).
     */
    convertFromParticleAtCell(x: number, y: number): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.convertFromParticleAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.convertFromParticleAtCell failed`, x, y, e);
            return false;
        }
    },

    /** Convert from particle, guarded on the cell id being unchanged. */
    convertFromParticleAtCellWhenIdle(x: number, y: number): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.convertFromParticleAtCellWhenIdle ??
                ns?.convertFromParticleAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} elements.convertFromParticleAtCellWhenIdle failed`,
                x,
                y,
                e,
            );
            return false;
        }
    },

    /** Convert to particle, guarded on the cell id being unchanged. */
    convertToParticleAtCellWhenIdle(x: number, y: number, velocity: Vector2): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.convertToParticleAtCellWhenIdle ??
                ns?.convertToParticleAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, velocity);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} elements.convertToParticleAtCellWhenIdle failed`,
                x,
                y,
                e,
            );
            return false;
        }
    },

    /** Set velocity, guarded on the cell id being unchanged. */
    setVelocityAtCellWhenIdle(x: number, y: number, velocity: Vector2): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.setVelocityAtCellWhenIdle ?? ns?.setVelocityAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, velocity);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setVelocityAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Add particle velocity, guarded on the cell id being unchanged. */
    addParticleVelocityAtCellWhenIdle(
        x: number,
        y: number,
        velocity: Vector2,
        maxSpeed?: number,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.addParticleVelocityAtCellWhenIdle ??
                ns?.addParticleVelocityAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, velocity, maxSpeed);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} elements.addParticleVelocityAtCellWhenIdle failed`,
                x,
                y,
                e,
            );
            return false;
        }
    },

    /** Set a data field, guarded on the cell id being unchanged. */
    setDataFieldAtCellWhenIdle(
        x: number,
        y: number,
        field: number,
        value: number,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.setDataFieldAtCellWhenIdle ?? ns?.setDataFieldAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, field, value);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} elements.setDataFieldAtCellWhenIdle failed`,
                x,
                y,
                e,
            );
            return false;
        }
    },

    /** Set duration, guarded on the cell id being unchanged. */
    setDurationAtCellWhenIdle(
        x: number,
        y: number,
        n: number,
        opts?: { updateMax?: boolean },
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.setDurationAtCellWhenIdle ?? ns?.setDurationAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, n, opts);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.setDurationAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Teleport, guarded on the source cell id being unchanged. */
    teleportBetweenCellsWhenIdle(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.teleportBetweenCellsWhenIdle ??
                ns?.teleportBetweenCells;
            if (typeof fn !== "function") return false;
            fn.call(ns, fromX, fromY, toX, toY);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} elements.teleportBetweenCellsWhenIdle failed`,
                fromX,
                fromY,
                e,
            );
            return false;
        }
    },

    removeAtCell(x: number, y: number, options?: unknown): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.removeAtCell !== "function") return false;
            ns.removeAtCell(x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.removeAtCell failed`, x, y, e);
            return false;
        }
    },
    removeAtCellWhenIdle(x: number, y: number, options?: unknown): boolean {
        try {
            const ns = g()?.api?.elements;
            const fn = ns?.removeAtCellWhenIdle ?? ns?.removeAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.removeAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },
    convertToParticleAtCell(
        x: number,
        y: number,
        velocity: { x: number; y: number },
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.convertToParticleAtCell !== "function") return false;
            ns.convertToParticleAtCell(x, y, velocity, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.convertToParticleAtCell failed`, x, y, e);
            return false;
        }
    },
    getDataFieldAtCell(x: number, y: number, field: number): number | null {
        try {
            return g()?.api?.elements?.getDataFieldAtCell?.(x, y, field) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.getDataFieldAtCell failed`, x, y, e);
            return null;
        }
    },
    setDataFieldAtCell(
        x: number,
        y: number,
        field: number,
        value: number,
    ): void {
        try {
            g()?.api?.elements?.setDataFieldAtCell?.(x, y, field, value);
        } catch (e) {
            console.warn(`${LOG} elements.setDataFieldAtCell failed`, x, y, e);
        }
    },

    getVelocityAtCell(x: number, y: number): { x: number; y: number } | null {
        try {
            const v = g()?.api?.elements?.getVelocityAtCell?.(x, y) as
                | { x?: number; y?: number }
                | null
                | undefined;

            return v ? { x: v.x ?? 0, y: v.y ?? 0 } : null;
        } catch (e) {
            console.warn(`${LOG} elements.getVelocityAtCell failed`, x, y, e);
            return null;
        }
    },

    teleportBetweenCells(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ): boolean {
        try {
            const ns = g()?.api?.elements;
            if (typeof ns?.teleportBetweenCells !== "function") return false;

            ns.teleportBetweenCells(fromX, fromY, toX, toY);
            return true;
        } catch (e) {
            console.warn(`${LOG} elements.teleportBetweenCells failed`, e);
            return false;
        }
    },

    findFreeCellInStructure(
        x: number,
        y: number,
        size: number,
    ): Vector2 | null {
        try {
            return (g()?.api?.elements?.findFreeCellInStructure?.(x, y, size) as
                | Vector2
                | null) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.findFreeCellInStructure failed`, e);
            return null;
        }
    },
};
