import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type ElementConfig } from "../types.ts";
import { normalizeElement } from "../internal/normalize.ts";

export const elements = {
    register(def: ElementConfig): { elementType?: number } | undefined {
        try {
            return g()?.api?.elements?.register?.(normalizeElement(def));
        } catch (e) {
            console.error(`${LOG} elements.register failed`, def.id, e);
            return undefined;
        }
    },
    updateDefinition(idOrType: string | number, partial: Record<string, unknown>) {
        try {
            g()?.api?.elements?.updateDefinition?.(idOrType, partial);
        } catch (e) {
            console.error(`${LOG} elements.updateDefinition failed`, e);
        }
    },
    addInteractionInfo(idOrType: string | number, interaction: unknown) {
        try {
            g()?.api?.elements?.addInteractionInfo?.(idOrType, interaction);
        } catch (e) {
            console.error(`${LOG} elements.addInteractionInfo failed`, e);
        }
    },

    addElementToDiscoveries(elementType: number) {
        try {
            const d = g()?.api?.discoveries;
            if (d?.addElement) d.addElement(elementType);
            else d?.addElementByType?.(elementType);
        } catch (e) {
            console.error(`${LOG} discoveries.addElement failed`, e);
        }
    },

    getTypeById(id: string): number | undefined {
        try {
            return g()?.api?.elements?.getTypeById?.(id);
        } catch {
            return undefined;
        }
    },

    getRegisteredTypes(): number[] {
        try {
            return g()?.api?.elements?.getRegisteredTypes?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} elements.getRegisteredTypes failed`, e);
            return [];
        }
    },

    getDefinitionByType(t: number): Record<string, unknown> | undefined {
        try {
            return g()?.api?.elements?.getDefinitionByType?.(t) as
                | Record<string, unknown>
                | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getDefinitionByType failed`, t, e);
            return undefined;
        }
    },

    getIdByType(t: number): string | undefined {
        try {
            return g()?.api?.elements?.getIdByType?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getNameByType(t: number): string | undefined {
        try {
            return g()?.api?.elements?.getNameByType?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} elements.getNameByType failed`, t, e);
            return undefined;
        }
    },

    getResolvedTypeAtCell(x: number, y: number): number | undefined {
        try {
            return g()?.api?.elements?.getResolvedTypeAtCell?.(x, y);
        } catch (e) {
            console.warn(`${LOG} elements.getResolvedTypeAtCell failed`, x, y, e);
            return undefined;
        }
    },

    getTypeAtCell(x: number, y: number): number | null {
        try {
            return g()?.api?.elements?.getTypeAtCell?.(x, y) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.getTypeAtCell failed`, x, y, e);
            return null;
        }
    },

    getTypeFromId(id: string): number | null {
        try {
            return g()?.api?.elements?.getTypeFromId?.(id) ?? null;
        } catch (e) {
            console.warn(`${LOG} elements.getTypeFromId failed`, id, e);
            return null;
        }
    },

    isTypeAtCell(x: number, y: number, type: number): boolean {
        try {
            return g()?.api?.elements?.isTypeAtCell?.(x, y, type) === true;
        } catch (e) {
            console.warn(`${LOG} elements.isTypeAtCell failed`, x, y, e);
            return false;
        }
    },

    setVelocityAtCell(
        x: number,
        y: number,
        velocity: { x: number; y: number },
    ): boolean {
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
        velocity: { x: number; y: number },
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
    ): { x: number; y: number } | null {
        try {
            return g()?.api?.elements?.findFreeCellInStructure?.(x, y, size) ??
                null;
        } catch (e) {
            console.warn(`${LOG} elements.findFreeCellInStructure failed`, e);
            return null;
        }
    },
};
