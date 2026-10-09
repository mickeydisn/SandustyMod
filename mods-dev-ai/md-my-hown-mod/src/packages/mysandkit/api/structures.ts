import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type StructureConfig, type StructureRegisterOptions } from "../types.ts";
import { normalizeStructure } from "../internal/normalize.ts";
import { resolveStructureType } from "../internal/refs.ts";
import type {
    PlacementConfigDefinition,
    StructureId,
    StructureProcessingDefinition,
    StructureRecipeDefinition,
    StructureRef,
    StructureType,
    StructureVariant,
} from "../host-types/domain.d.ts";

/** Runtime structure instance handed to callbacks by the host. */
export type StructureInstance = Record<string, unknown> & {
    /** Structure id, when the host reports one. */
    id?: StructureId;
};

export const structures = {
    /**
     * Register a placement-cap override.
     *
     * The engine throws on a missing `structureId`, empty `fields`, duplicate
     * field ids, or an unlabelled field — see `PlacementConfigDefinition`.
     */
    registerPlacementConfig(definition: PlacementConfigDefinition): boolean {
        try {
            const ns = g()?.api?.structures as
                | { registerPlacementConfig?: (d: PlacementConfigDefinition) => unknown }
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
        ref: StructureRef,
        partial: Partial<StructureConfig>,
        options?: StructureRegisterOptions,
    ): void {
        try {
            g()?.api?.structures?.updateDefinition?.(ref, partial, options);
        } catch (e) {
            console.error(`${LOG} structures.updateDefinition failed`, ref, e);
        }
    },

    getRegisteredTypes(): StructureType[] {
        try {
            return (g()?.api?.structures?.getRegisteredTypes?.() ?? []) as StructureType[];
        } catch (e) {
            console.warn(`${LOG} structures.getRegisteredTypes failed`, e);
            return [];
        }
    },

    getUnlockedTypes(): StructureType[] {
        try {
            return (g()?.api?.structures?.getUnlockedTypes?.() ?? []) as StructureType[];
        } catch (e) {
            console.warn(`${LOG} structures.getUnlockedTypes failed`, e);
            return [];
        }
    },

    getTypeName(t: StructureType): string | undefined {
        try {
            return g()?.api?.structures?.getTypeName?.(t) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getTypeName failed`, t, e);
            return undefined;
        }
    },
    getAll(): StructureInstance[] {
        try {
            return (g()?.api?.structures?.getAll?.() ?? []) as StructureInstance[];
        } catch (e) {
            console.warn(`${LOG} structures.getAll failed`, e);
            return [];
        }
    },
    getRegistered(): StructureInstance[] {
        try {
            return (g()?.api?.structures?.getRegistered?.() ?? []) as StructureInstance[];
        } catch (e) {
            console.warn(`${LOG} structures.getRegistered failed`, e);
            return [];
        }
    },
    list(): StructureInstance[] {
        try {
            return (g()?.api?.structures?.list?.() ?? []) as StructureInstance[];
        } catch (e) {
            console.warn(`${LOG} structures.list failed`, e);
            return [];
        }
    },
    includes(ref: StructureRef): boolean {
        try {
            return g()?.api?.structures?.includes?.(ref) === true;
        } catch (e) {
            console.warn(`${LOG} structures.includes failed`, ref, e);
            return false;
        }
    },

    getAtCell(x: number, y: number): StructureInstance | null {
        try {
            return (g()?.api?.structures?.getAtCell?.(x, y) as StructureInstance | null) ??
                null;
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

    isTypeAtCell(x: number, y: number, ref: StructureRef): boolean {
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

    /**
     * Remove every structure inside an inclusive rectangle.
     *
     * Both corners are absolute cell coordinates, inclusive of both edges.
     */
    removeBetweenCells(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            const fn = ns?.removeBetweenCells;
            if (typeof fn !== "function") return false;
            fn.call(ns, startX, startY, endX, endY, options);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} structures.removeBetweenCells failed`,
                startX,
                startY,
                endX,
                endY,
                e,
            );
            return false;
        }
    },

    /** Build at a cell, deferred until the simulation is idle. */
    buildAtCellWhenIdle(
        x: number,
        y: number,
        ref: string,
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            const fn = ns?.buildAtCellWhenIdle ?? ns?.buildAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, ref, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.buildAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Remove at a cell, deferred until the simulation is idle. */
    removeAtCellWhenIdle(x: number, y: number, options?: unknown): boolean {
        try {
            const ns = g()?.api?.structures;
            const fn = ns?.removeAtCellWhenIdle ?? ns?.removeAtCell;
            if (typeof fn !== "function") return false;
            fn.call(ns, x, y, options);
            return true;
        } catch (e) {
            console.warn(`${LOG} structures.removeAtCellWhenIdle failed`, x, y, e);
            return false;
        }
    },

    /** Remove many cells, deferred until the simulation is idle. */
    removeAtCellsWhenIdle(
        positions: { x: number; y: number }[],
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            const fn = ns?.removeAtCellsWhenIdle ?? ns?.removeAtCells;
            if (typeof fn !== "function") return false;
            fn.call(ns, positions, options);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} structures.removeAtCellsWhenIdle failed`,
                positions.length,
                e,
            );
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
    /** Alias of {@link updateData}; identical host call. */
    setData(
        structure: unknown,
        partial: Record<string, unknown>,
        options?: unknown,
    ): boolean {
        return structures.updateData(structure, partial, options);
    },

    /**
     * Attach a processor to an already-registered structure type.
     *
     * Runs the same validator as `processing.register`: `intervalMs` must be
     * finite and positive and `process` must be synchronous, or the host
     * throws (`extra-mod-runtime.js` 2160-2162; validator at 775-782).
     */
    addProcessor(
        ref: StructureRef,
        definition: StructureProcessingDefinition,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            if (typeof ns?.addProcessor !== "function") return false;
            ns.addProcessor(ref, definition);
            return true;
        } catch (e) {
            console.error(`${LOG} structures.addProcessor failed`, ref, e);
            return false;
        }
    },

    /** Remove every structure inside an inclusive rectangle, when idle. */
    removeBetweenCellsWhenIdle(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        options?: unknown,
    ): boolean {
        try {
            const ns = g()?.api?.structures;
            const fn = ns?.removeBetweenCellsWhenIdle ?? ns?.removeBetweenCells;
            if (typeof fn !== "function") return false;
            fn.call(ns, startX, startY, endX, endY, options);
            return true;
        } catch (e) {
            console.warn(
                `${LOG} structures.removeBetweenCellsWhenIdle failed`,
                startX,
                startY,
                endX,
                endY,
                e,
            );
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
        register(
            structureType: StructureRef,
            def: StructureProcessingDefinition,
        ): void {
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
        register(structureType: StructureRef, recipe: StructureRecipeDefinition): void {
            try {
                const st = resolveStructureType(structureType);
                g()?.api?.structures?.recipes?.register?.(st, recipe);
            } catch (e) {
                console.error(`${LOG} structures.recipes.register failed`, e);
            }
        },
    },
    addVariant(
        base: StructureRef,
        variant: StructureVariant,
        options?: StructureRegisterOptions,
    ): void {
        try {
            const fn = g()?.api?.structures?.addVariant ??
                g()?.api?.structures?.registerVariant;
            fn?.(base, variant, options);
        } catch (e) {
            console.error(`${LOG} structures.addVariant failed`, e);
        }
    },

    /** Host name for {@link structures.addVariant}. */
    registerVariant(
        base: StructureRef,
        variant: StructureVariant,
        options?: StructureRegisterOptions,
    ): void {
        structures.addVariant(base, variant, options);
    },

    /**
     * Whether a structure type is still locked.
     *
     * Inverted internally — the facade computes `!isUnlocked`
     * (`extra-mod-runtime.js` 2138).
     */
    isLockedByType(ref: StructureRef): boolean {
        try {
            return g()?.api?.structures?.isLockedByType?.(ref) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isLockedByType failed`, ref, e);
            return false;
        }
    },

    /** Unlocked counterpart of {@link isLockedByType}. */
    isUnlockedByType(ref: StructureRef): boolean {
        try {
            return g()?.api?.structures?.isUnlockedByType?.(ref) === true;
        } catch (e) {
            console.warn(`${LOG} structures.isUnlockedByType failed`, ref, e);
            return false;
        }
    },

    /** Alias of {@link getTypeById}; identical resolution, different name. */
    getTypeFromId(id: StructureId): StructureRef | undefined {
        return structures.getTypeById(id);
    },

    /**
     * Run a callback for every placed instance of a structure type.
     *
     * The callback receives each instance. Host-side this forwards straight to
     * `structures.forEachOfType` (`extra-mod-runtime.js` 2174).
     */
    forEachOfType(
        ref: StructureRef,
        callback: (structure: StructureInstance) => void,
    ): boolean {
        try {
            const fn = g()?.api?.structures?.forEachOfType;
            if (typeof fn !== "function") return false;
            fn.call(g()?.api?.structures, ref, callback);
            return true;
        } catch (e) {
            console.error(`${LOG} structures.forEachOfType failed`, ref, e);
            return false;
        }
    },

    getAvailableTypes(): Set<StructureRef> {
        try {
            return (g()?.api?.structures?.getAvailableTypes?.() ??
                new Set()) as Set<StructureRef>;
        } catch (e) {
            console.warn(`${LOG} structures.getAvailableTypes failed`, e);
            return new Set();
        }
    },

    getDefinitionByType(ref: StructureRef): StructureConfig | undefined {
        try {
            return g()?.api?.structures?.getDefinitionByType?.(ref) as
                | StructureConfig
                | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getDefinitionByType failed`, ref, e);
            return undefined;
        }
    },

    getIdByType(t: StructureType): StructureId | undefined {
        try {
            return g()?.api?.structures?.getIdByType?.(t) as StructureId | undefined;
        } catch (e) {
            console.warn(`${LOG} structures.getIdByType failed`, t, e);
            return undefined;
        }
    },

    getTypeById(id: StructureId): StructureType | StructureId {
        try {
            const s = g()?.api?.structures as
                | {
                    getTypeFromId?: (a: StructureId) => StructureType;
                    getTypeById?: (a: StructureId) => StructureType;
                }
                | undefined;
            return s?.getTypeFromId?.(id) ?? s?.getTypeById?.(id) ?? id;
        } catch (e) {
            console.warn(`${LOG} structures.getTypeById failed`, id, e);
            return id;
        }
    },

    countOfType(ref: StructureRef): number | null {
        try {
            const fn = g()?.api?.structures?.forEachOfType as
                | ((a: StructureRef, b: (s: StructureInstance) => void) => unknown)
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
