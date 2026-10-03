import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type StructureConfig } from "../types.ts";
import { normalizeStructure } from "../internal/normalize.ts";
import { resolveStructureType } from "../internal/refs.ts";

export const structures = {
    registerPlacementConfig(definition: unknown): boolean {
        try {
            const ns = g()?.api?.structures as
                | { registerPlacementConfig?: (definition: unknown) => unknown }
                | undefined;
            if (typeof ns?.registerPlacementConfig !== "function") return false;
            ns.registerPlacementConfig(definition);
            return true;
        } catch (e) {
            console.error(`${LOG} structures.registerPlacementConfig failed`, e);
            return false;
        }
    },
    updateDefinition(
        idOrType: string | number,
        partial: Record<string, unknown>,
        options?: { useRawShape?: boolean },
    ): void {
        try {
            g()?.api?.structures?.updateDefinition?.(idOrType, partial, options);
        } catch (e) {
            console.error(`${LOG} structures.updateDefinition failed`, idOrType, e);
        }
    },

    getRegisteredTypes(): number[] {
        try {
            return g()?.api?.structures?.getRegisteredTypes?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} structures.getRegisteredTypes failed`, e);
            return [];
        }
    },

    getUnlockedTypes(): number[] {
        try {
            return g()?.api?.structures?.getUnlockedTypes?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} structures.getUnlockedTypes failed`, e);
            return [];
        }
    },

    getTypeName(t: number): string | undefined {
        try {
            return g()?.api?.structures?.getTypeName?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getTypeName failed`, t, e);
            return undefined;
        }
    },
    getAll(): Record<string, unknown>[] {
        try {
            return g()?.api?.structures?.getAll?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} structures.getAll failed`, e);
            return [];
        }
    },
    getRegistered(): Record<string, unknown>[] {
        try {
            return g()?.api?.structures?.getRegistered?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} structures.getRegistered failed`, e);
            return [];
        }
    },
    list(): Record<string, unknown>[] {
        try {
            return g()?.api?.structures?.list?.() ?? [];
        } catch (e) {
            console.warn(`${LOG} structures.list failed`, e);
            return [];
        }
    },
    includes(idOrType: string | number): boolean {
        try {
            return g()?.api?.structures?.includes?.(idOrType) === true;
        } catch (e) {
            console.warn(`${LOG} structures.includes failed`, idOrType, e);
            return false;
        }
    },

    getAtCell(x: number, y: number): Record<string, unknown> | null {
        try {
            return g()?.api?.structures?.getAtCell?.(x, y) ?? null;
        } catch (e) {
            console.warn(`${LOG} structures.getAtCell failed`, x, y, e);
            return null;
        }
    },
    hasBuiltAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.structures?.hasBuiltAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} structures.hasBuiltAtCell failed`, x, y, e);
            return false;
        }
    },

    isTypeAtCell(x: number, y: number, ref: string | number): boolean {
        try {
            return g()?.api?.structures?.isTypeAtCell?.(x, y, ref) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isTypeAtCell failed`, x, y, e);
            return false;
        }
    },

    isType(structure: unknown, ref: string): boolean {
        try {
            return g()?.api?.structures?.isType?.(structure, ref) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isType failed`, ref, e);
            return false;
        }
    },
    isBlockedByPlayerAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.structures?.isBlockedByPlayerAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isBlockedByPlayerAtCell failed`, x, y, e);
            return false;
        }
    },
    isLauncherAtCell(x: number, y: number): boolean {
        try {
            return g()?.api?.structures?.isLauncherAtCell?.(x, y) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isLauncherAtCell failed`, x, y, e);
            return false;
        }
    },
    buildAtCell(x: number, y: number, ref: string, options?: unknown): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.buildAtCell !== "function") return false;
            ns.buildAtCell(x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.buildAtCell failed`, x, y, e);
            return false;
        }
    },
    removeAtCell(x: number, y: number, options?: unknown): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.removeAtCell !== "function") return false;
            ns.removeAtCell(x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.removeAtCell failed`, x, y, e);
            return false;
        }
    },

    removeAtCells(
        positions: { x: number; y: number }[],
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.removeAtCells !== "function") return false;
            ns.removeAtCells(positions, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.removeAtCells failed`, positions.length, e);
            return false;
        }
    },
    update(structure: unknown, options?: unknown): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.update !== "function") return false;
            ns.update(structure, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.update failed`, e);
            return false;
        }
    },
    updateData(
        structure: unknown,
        partial: Record<string, unknown>,
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.updateData !== "function") return false;
            ns.updateData(structure, partial, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.updateData failed`, e);
            return false;
        }
    },
    setSpritesheetIndex(structure: unknown, index: number): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.setSpritesheetIndex !== "function") return false;
            ns.setSpritesheetIndex(structure, index);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.setSpritesheetIndex failed`, e);
            return false;
        }
    },
    setSpritesheetIndexAtCell(x: number, y: number, index: number): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.setSpritesheetIndexAtCell !== "function") return false;
            ns.setSpritesheetIndexAtCell(x, y, index);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.setSpritesheetIndexAtCell failed`, x, y, e);
            return false;
        }
    },
    setSpritesheetIndexByValue(
        structure: unknown,
        value: number,
        thresholds: number[],
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.setSpritesheetIndexByValue !== "function") return false;
            ns.setSpritesheetIndexByValue(structure, value, thresholds);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.setSpritesheetIndexByValue failed`, e);
            return false;
        }
    },
    setSpritesheetIndexByValueAtCell(
        x: number,
        y: number,
        value: number,
        thresholds: number[],
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.setSpritesheetIndexByValueAtCell !== "function") return false;
            ns.setSpritesheetIndexByValueAtCell(x, y, value, thresholds);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.setSpritesheetIndexByValueAtCell failed`, e);
            return false;
        }
    },
    mapValueToSpritesheetIndex(value: number, thresholds: number[]): number {
        try {
            return g()?.api?.structures?.mapValueToSpritesheetIndex?.(
                value,
                thresholds,
            ) as number;
        } catch (e) {
            console.warn(`${LOG} structures.mapValueToSpritesheetIndex failed`, e);
            return 0;
        }
    },

    processing: {
        register(structureType: string | number, def: Record<string, unknown>): void {
            try {
                const st = resolveStructureType(structureType);
                g()?.api?.structures?.processing?.register?.(st, def);
            } catch (e) {
                console.error(`${LOG} structures.processing.register failed`, e);
            }
        },

        isEnabledAtCell(x: number, y: number): boolean {
            try {
                return g()?.api?.structures?.processing?.isEnabledAtCell?.(x, y) === true;
            } catch (e) {
                console.warn(`${LOG} structures.processing.isEnabledAtCell failed`, e);
                return false;
            }
        },
        setEnabledAtCell(x: number, y: number, enabled: boolean): boolean {
            try {
                const ns = g()?.api?.structures?.processing;
                if (typeof ns?.setEnabledAtCell !== "function") return false;

                ns.setEnabledAtCell(x, y, enabled);
                return true;
            } catch (e) {
                console.warn(`${LOG} structures.processing.setEnabledAtCell failed`, e);
                return false;
            }
        },
    },
    register(def: StructureConfig): void {
        try {
            const { registerOptions, ...body } = normalizeStructure(def);
            const opts = registerOptions ?? def.registerOptions;
            if (opts) {
                g()?.api?.structures?.register?.(body, opts);
            } else {
                g()?.api?.structures?.register?.(body);
            }
        } catch (e) {
            console.error(`${LOG} structures.register failed`, def.id, e);
        }
    },
    recipes: {
        register(structureType: string | number, recipe: Record<string, unknown>): void {
            try {
                const st = resolveStructureType(structureType);
                g()?.api?.structures?.recipes?.register?.(st, recipe);
            } catch (e) {
                console.error(`${LOG} structures.recipes.register failed`, e);
            }
        },
    },
    addVariant(base: string | number, variant: unknown, options?: unknown): void {
        try {
            const fn = g()?.api?.structures?.addVariant ??
                g()?.api?.structures?.registerVariant;
            fn?.(base, variant, options);
        } catch (e) {
            console.error(`${LOG} structures.addVariant failed`, e);
        }
    },

    getAvailableTypes(): Set<number | string> {
        try {
            return g()?.api?.structures?.getAvailableTypes?.() ?? new Set();
        } catch (e) {
            console.warn(`${LOG} structures.getAvailableTypes failed`, e);
            return new Set();
        }
    },

    getDefinitionByType(ref: number | string): Record<string, unknown> | undefined {
        try {
            return (g()?.api?.structures?.getDefinitionByType?.(ref) ?? undefined) as
                | Record<string, unknown>
                | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getDefinitionByType failed`, ref, e);
            return undefined;
        }
    },

    getIdByType(t: number): string | undefined {
        try {
            return g()?.api?.structures?.getIdByType?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getTypeById(id: string): number | string {
        try {
            const s = g()?.api?.structures as
                | {
                    getTypeFromId?: (a: string) => number;
                    getTypeById?: (a: string) => number;
                }
                | undefined;
            return s?.getTypeFromId?.(id) ?? s?.getTypeById?.(id) ?? id;
        } catch (e) {
            console.warn(`${LOG} structures.getTypeById failed`, id, e);
            return id;
        }
    },

    countOfType(ref: number | string): number | null {
        try {
            const fn = g()?.api?.structures?.forEachOfType as
                | ((a: number | string, b: () => void) => unknown)
                | undefined;
            if (typeof fn !== "function") return null;
            let n = 0;
            fn(ref, () => {
                n++;
            });
            return n;
        } catch (e) {
            console.warn(`${LOG} structures.forEachOfType failed`, ref, e);
            return null;
        }
    },
};
