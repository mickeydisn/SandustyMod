import {
    type ContactReactionConfig,
    type ElementConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    MOD_ID,
    type ProcessingConfig,
    type RecipeConfig,
    type StructureConfig,
} from "../constants.ts";

import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";

declare const sandkit: any;

type SignalHandler = (...args: unknown[]) => unknown;

export const g = () => {
    try {
        if (typeof sandkit !== "undefined" && sandkit) return sandkit;
    } catch {}
    return (globalThis as any).sandkit ?? (globalThis as any).__sandkit;
};
export const api = {
    get raw() {
        return g()?.api;
    },
    get host() {
        return g();
    },
    get enums() {
        return g()?.enums;
    },
    get react() {
        return g()?.react;
    },
    get mods() {
        return g()?.mods;
    },
    toast(msg: string, opts?: Record<string, unknown>) {
        try {
            g()?.api?.ui?.toast?.(msg, opts ?? {});
        } catch {}
    },
    storage: {
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
    },

    settings: {
        get(fieldId: string): unknown {
            try {
                return g()?.api?.settings?.get?.(fieldId);
            } catch (e) {
                console.warn(`${LOG} settings.get failed`, fieldId, e);
                return undefined;
            }
        },

        onChange(cb: () => void): (() => void) | undefined {
            try {
                const unsub = g()?.api?.settings?.onChange?.(cb);
                return typeof unsub === "function" ? unsub : undefined;
            } catch (e) {
                console.warn(`${LOG} settings.onChange failed`, e);
                return undefined;
            }
        },
    },

    state: {
        get store(): Record<string, any> | undefined {
            try {
                return g()?.state?.store as Record<string, any> | undefined;
            } catch (e) {
                console.warn(`${LOG} state.store failed`, e);
                return undefined;
            }
        },
    },
    rendering: {
        getGridMetrics(): { cellSize?: number } | undefined {
            try {
                return g()?.api?.rendering?.getGridMetrics?.() as
                    | { cellSize?: number }
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} rendering.getGridMetrics failed`, e);
                return undefined;
            }
        },
        getDrawPositionAtCell(cx: number, cy: number): { x: number; y: number } | undefined {
            try {
                return g()?.api?.rendering?.getDrawPositionAtCell?.(cx, cy) as
                    | { x: number; y: number }
                    | undefined;
            } catch (e) {
                console.warn(`${LOG} rendering.getDrawPositionAtCell failed`, cx, cy, e);
                return undefined;
            }
        },
    },
    elements: {
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
    },

    grid: {
        isCellEmptyAtCell(x: number, y: number): boolean | undefined {
            try {
                return g()?.api?.grid?.isCellEmptyAtCell?.(x, y);
            } catch (e) {
                console.warn(`${LOG} grid.isCellEmptyAtCell failed`, x, y, e);
                return undefined;
            }
        },
        isTerrainAtCell(x: number, y: number): boolean {
            try {
                return g()?.api?.grid?.isTerrainAtCell?.(x, y) === true;
            } catch (e) {
                console.warn(`${LOG} grid.isTerrainAtCell failed`, x, y, e);
                return false;
            }
        },
        reportActivityAtCell(x: number, y: number): void {
            try {
                g()?.api?.grid?.reportActivityAtCell?.(x, y);
            } catch (e) {
                console.warn(`${LOG} grid.reportActivityAtCell failed`, x, y, e);
            }
        },
        mutate<T extends object>(fn: (writer: T) => void): boolean {
            try {
                const ns = g()?.api?.grid;
                if (typeof ns?.mutate !== "function") return false;
                ns.mutate(fn);
                return true;
            } catch (e) {
                console.warn(`${LOG} grid.mutate failed`, e);
                return false;
            }
        },

        excavateAtCell(
            x: number,
            y: number,
            outVelocity: Record<string, number>,
            damage: number,
            opts?: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.grid?.excavateAtCell?.(x, y, outVelocity, damage, opts ?? {});
            } catch (e) {
                console.warn(`${LOG} grid.excavateAtCell failed`, x, y, e);
            }
        },
    },

    player: {
        inventory: {
            addById(
                itemId: string,
                amount = 1,
            ): boolean {
                try {
                    const ns = g()?.api?.player?.inventory;
                    if (typeof ns?.addById !== "function") return false;
                    ns.addById(itemId, amount);
                    return true;
                } catch (e) {
                    console.warn(`${LOG} player.inventory.addById failed`, itemId, e);
                    return false;
                }
            },
        },
        buildings: {
            unlockById(structureId: string): boolean {
                try {
                    const fn = g()?.api?.player?.buildings?.unlockById;
                    if (typeof fn !== "function") return false;
                    fn(structureId);
                    return true;
                } catch (e) {
                    console.error(`${LOG} player.buildings.unlockById failed`, structureId, e);
                    return false;
                }
            },

            removeById(structureId: string): boolean {
                try {
                    const fn = g()?.api?.player?.buildings?.removeById;
                    if (typeof fn !== "function") return false;
                    fn(structureId);
                    return true;
                } catch (e) {
                    console.error(`${LOG} player.buildings.removeById failed`, structureId, e);
                    return false;
                }
            },
        },
    },
    structures: {
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
    },
    items: {
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
    },

    tech: {
        registerDefinition(id: string, body: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.tech;
                const fn = ns?.registerDefinition ?? ns?.addDefinition;
                if (typeof fn !== "function") return false;
                fn.call(ns, id, body);
                return true;
            } catch (e) {
                console.error(`${LOG} tech.registerDefinition failed`, id, e);
                return false;
            }
        },
        registerNode(
            id: string,
            body: Record<string, unknown>,
            opts: Record<string, unknown>,
        ): boolean {
            try {
                const ns = g()?.api?.tech;
                if (typeof ns?.registerNode !== "function") return false;
                ns.registerNode(id, body, opts);
                return true;
            } catch (e) {
                console.warn(`${LOG} tech.registerNode failed`, id, e);
                return false;
            }
        },
        updateDefinition(id: string, partial: Record<string, unknown>): void {
            try {
                g()?.api?.tech?.updateDefinition?.(id, partial);
            } catch (e) {
                console.error(`${LOG} tech.updateDefinition failed`, id, e);
            }
        },

        conservatory: {
            appendUnlock(techId: string, unlocks: Record<string, unknown>): boolean {
                try {
                    const ns = g()?.api?.tech?.conservatory;
                    if (typeof ns?.appendUnlock !== "function") return false;
                    ns.appendUnlock(techId, unlocks);
                    return true;
                } catch (e) {
                    console.warn(`${LOG} tech.conservatory.appendUnlock failed`, techId, e);
                    return false;
                }
            },
        },
    },
    terrains: {
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
            const data = api.terrains.getDataAtCell(x, y) as
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
    },
    upgrades: {
        register(def: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.upgrades;
                if (typeof ns?.register !== "function") return false;
                ns.register(def);
                return true;
            } catch (e) {
                console.error(`${LOG} upgrades.register failed`, def.id, e);
                return false;
            }
        },
        registerCategory(def: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.upgrades;
                if (typeof ns?.registerCategory !== "function") return false;
                ns.registerCategory(def);
                return true;
            } catch (e) {
                console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
                return false;
            }
        },
        updateDefinition(
            itemId: string,
            upgradeId: string,
            partial: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.upgrades?.updateDefinition?.(itemId, upgradeId, partial);
            } catch (e) {
                console.error(`${LOG} upgrades.updateDefinition failed`, itemId, upgradeId, e);
            }
        },

        setLevelById(itemId: string, upgradeId: string, level: number): void {
            try {
                g()?.api?.upgrades?.setLevelById?.(itemId, upgradeId, level);
            } catch (e) {
                console.warn(`${LOG} upgrades.setLevelById failed`, itemId, upgradeId, e);
            }
        },
    },
    processing: {
        registerGrower(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerGrower?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerGrower failed`, e);
            }
        },
        registerShaker(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerShaker?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerShaker failed`, e);
            }
        },
        registerKineticPress(def: Record<string, unknown>): void {
            try {
                g()?.api?.processing?.registerKineticPress?.(def);
            } catch (e) {
                console.error(`${LOG} processing.registerKineticPress failed`, e);
            }
        },
    },
    reactions: {
        registerContact(def: Record<string, unknown>): void {
            try {
                g()?.api?.reactions?.registerContact?.(def);
            } catch (e) {
                console.error(`${LOG} reactions.registerContact failed`, e);
            }
        },
    },
    ui: {
        overlays: {
            register(zone: string, id: string, component: unknown, opts?: Record<string, unknown>) {
                try {
                    {
                        const React = g()?.react;
                        const render = typeof component === "function" && component.length === 0
                            ? component
                            : () => (React ? React.createElement(component as any) : null);
                        g()?.api?.ui?.overlays?.register?.(zone, id, render);
                    }
                } catch (e) {
                    console.error(`${LOG} ui.overlays.register failed`, id, e);
                }
            },
            unregister(zone: string, id: string) {
                try {
                    g()?.api?.ui?.overlays?.unregister?.(zone, id);
                } catch {}
            },
        },

        toast(message: string): void {
            try {
                (g()?.api?.ui?.toast as ((m: string) => void) | undefined)?.(message);
            } catch (e) {
                console.warn(`${LOG} ui.toast failed`, message, e);
            }
        },
    },

    hooks: {
        hasHooks(): boolean {
            try {
                return !!g()?.api?.hooks;
            } catch {
                return false;
            }
        },
        intercept(
            id: string,
            fn: (args: never, context: { cancel?: () => void }) => unknown,
            opts?: Record<string, unknown>,
        ): unknown {
            try {
                return g()?.api?.hooks?.intercept?.(id, fn, opts);
            } catch (e) {
                console.error(`${LOG} hooks.intercept failed`, id, e);
                return undefined;
            }
        },

        modify(
            id: string,
            fn: (args: never, context: { cancel?: () => void }) => unknown,
            opts?: Record<string, unknown>,
        ): unknown {
            try {
                return g()?.api?.hooks?.modify?.(id, fn, opts);
            } catch (e) {
                console.error(`${LOG} hooks.modify failed`, id, e);
                return undefined;
            }
        },
    },
    events: {
        on(name: string, cb: (...args: any[]) => void): (() => void) | void {
            try {
                return g()?.api?.events?.on?.(name, cb);
            } catch {
                return undefined;
            }
        },
    },
    i18n: {
        register(locale: string, map: Record<string, string>) {
            try {
                g()?.api?.i18n?.register?.(locale, map);
            } catch {}
        },
    },

    assets: {
        getUrl(path: string): string | undefined {
            try {
                return g()?.api?.assets?.getUrl?.(path) as string | undefined;
            } catch (e) {
                console.warn(`${LOG} assets.getUrl failed`, path, e);
                return undefined;
            }
        },
    },

    sprites: {
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
    },

    input: {
        getMouseCellPosition(): { x: number; y: number } | null {
            try {
                return (g()?.api?.input?.getMouseCellPosition?.() as
                    | { x: number; y: number }
                    | null
                    | undefined) ?? null;
            } catch (e) {
                console.warn(`${LOG} input.getMouseCellPosition failed`, e);
                return null;
            }
        },
        registerBinding(
            bindingId: string,
            defaultKeys: readonly string[],
            definition: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.input?.registerBinding?.(bindingId, defaultKeys, definition);
            } catch (e) {
                console.warn(`${LOG} input.registerBinding failed`, bindingId, e);
            }
        },
    },

    signals: {
        registerTarget(
            kind: "targets" | "interactables" | "sender",
            target: string,
            handler: (...args: unknown[]) => unknown,
        ): boolean {
            try {
                const sig = g()?.api?.signals as
                    | {
                        targets?: { register?: (t: string, h: SignalHandler) => void };
                        interactables?: { register?: (t: string, h: SignalHandler) => void };
                        registerSenderType?: (t: string, h: SignalHandler) => void;
                    }
                    | undefined;
                if (!sig) return false;
                if (kind === "targets") {
                    if (typeof sig.targets?.register !== "function") return false;
                    sig.targets.register(target, handler);
                    return true;
                }
                if (kind === "interactables") {
                    if (typeof sig.interactables?.register !== "function") return false;
                    sig.interactables.register(target, handler);
                    return true;
                }
                if (typeof sig.registerSenderType !== "function") return false;
                sig.registerSenderType(target, handler);
                return true;
            } catch (e) {
                console.error(`${LOG} signals.registerTarget failed`, kind, target, e);
                return false;
            }
        },
        setOutputAtCell(x: number, y: number, value: boolean): void {
            try {
                g()?.api?.signals?.setOutputAtCell?.(x, y, value);
            } catch (e) {
                console.warn(`${LOG} signals.setOutputAtCell failed`, x, y, e);
            }
        },
    },

    energy: {
        registerType(
            structureId: string,
            type: "conductor" | "storage",
            options?: Record<string, unknown>,
        ): void {
            try {
                g()?.api?.energy?.registerType?.(structureId, type, options ?? {});
            } catch (e) {
                console.warn(`${LOG} energy.registerType failed`, structureId, e);
            }
        },

        addAtCell(x: number, y: number, amount: number): void {
            try {
                g()?.api?.energy?.addAtCell?.(x, y, amount);
            } catch (e) {
                console.warn(`${LOG} energy.addAtCell failed`, x, y, e);
            }
        },

        consume(amount: number, options?: Record<string, unknown>): number {
            try {
                return g()?.api?.energy?.consume?.(amount, options ?? {}) as number;
            } catch (e) {
                console.warn(`${LOG} energy.consume failed`, amount, e);
                return 0;
            }
        },
    },

    effects: {
        createParticlesAtWorld(
            x: number,
            y: number,
            options: { count?: number; [key: string]: unknown },
        ): void {
            try {
                g()?.api?.effects?.createParticlesAtWorld?.(x, y, options);
            } catch (e) {
                console.warn(`${LOG} effects.createParticlesAtWorld failed`, x, y, e);
            }
        },

        includes(effect: string): boolean {
            try {
                return g()?.api?.effects?.includes?.(effect) === true;
            } catch (e) {
                console.warn(`${LOG} effects.includes failed`, effect, e);
                return false;
            }
        },
    },

    projectiles: {
        register(def: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.projectiles;
                if (typeof ns?.register !== "function") return false;
                ns.register(def);
                return true;
            } catch (e) {
                console.error(`${LOG} projectiles.register failed`, def.id, e);
                return false;
            }
        },
        createBlueprintFromId(id: string): unknown {
            try {
                return g()?.api?.projectiles?.createBlueprintFromId?.(id);
            } catch (e) {
                console.warn(`${LOG} projectiles.createBlueprintFromId failed`, id, e);
                return undefined;
            }
        },

        spawnAtWorld(x: number, y: number, angle: number, blueprint: unknown): void {
            try {
                g()?.api?.projectiles?.spawnAtWorld?.(x, y, angle, blueprint);
            } catch (e) {
                console.warn(`${LOG} projectiles.spawnAtWorld failed`, x, y, e);
            }
        },
    },

    random: {
        int(min: number, max: number): number | undefined {
            try {
                return g()?.api?.random?.int?.(min, max) as number | undefined;
            } catch (e) {
                console.warn(`${LOG} random.int failed`, min, max, e);
                return min;
            }
        },
    },

    excavation: {
        registerProfile(id: string, payload: unknown): boolean {
            try {
                const ns = g()?.api?.excavation;
                if (typeof ns?.registerProfile !== "function") return false;
                ns.registerProfile(id, payload);
                return true;
            } catch (e) {
                console.error(`${LOG} excavation.registerProfile failed`, id, e);
                return false;
            }
        },
    },

    triggers: {
        register(triggerId: string, options: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.triggers;
                if (typeof ns?.register !== "function") return false;
                ns.register(triggerId, options);
                return true;
            } catch (e) {
                console.error(`${LOG} triggers.register failed`, triggerId, e);
                return false;
            }
        },
    },

    structureBehaviors: {
        registerConveyorType(id: string, options: unknown): boolean {
            try {
                const grouped = g()?.api?.structureBehaviors as
                    | { registerConveyorType?: (id: string, options: unknown) => void }
                    | undefined;
                if (typeof grouped?.registerConveyorType === "function") {
                    grouped.registerConveyorType(id, options);
                    return true;
                }
                const ns = g()?.api?.conveyors;
                if (typeof ns?.registerType !== "function") return false;
                ns.registerType(id, options);
                return true;
            } catch (e) {
                console.error(`${LOG} registerConveyorType failed`, id, e);
                return false;
            }
        },
        registerLauncherType(payload: unknown): boolean {
            try {
                const grouped = g()?.api?.structureBehaviors as
                    | { registerLauncherType?: (payload: unknown) => void }
                    | undefined;
                if (typeof grouped?.registerLauncherType === "function") {
                    grouped.registerLauncherType(payload);
                    return true;
                }
                const ns = g()?.api?.launchers;
                if (typeof ns?.registerType !== "function") return false;
                ns.registerType(payload);
                return true;
            } catch (e) {
                console.error(`${LOG} registerLauncherType failed`, e);
                return false;
            }
        },
    },
};

const MATTER_MAP: Record<string, number> = {
    solid: 1,
    liquid: 2,
    particle: 3,
    gas: 4,
    static: 5,
    slushy: 6,
    wisp: 7,
    powder: 8,
};

function resolveMatterType(v: string | number | undefined): number | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const lower = v.trim().toLowerCase();
        if (lower in MATTER_MAP) return MATTER_MAP[lower];

        if (/^\d+$/.test(lower)) return Number(lower);
        const enums = g()?.enums?.MatterType;
        if (enums) {
            const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

            const viaEnum = enums[cap];
            if (typeof viaEnum === "number") return viaEnum;
        }
    }
    return MATTER_MAP.powder;
}

export function resolveElementRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null) return null;
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const t = api.elements.getTypeById?.(v);
        return t !== undefined ? t : v;
    }
    return v;
}

function resolveStructureType(v: string | number): string | number {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.StructureType;
    if (typeof v === "string" && enums && v in enums) return enums[v];
    return v;
}

export function resolveTerrainRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v;
    const t = g()?.api?.terrains?.getTypeById?.(v);
    return t !== undefined && t !== null ? t : v;
}

function resolveItemType(v: string | number | undefined): number | string {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.ItemType;
    if (typeof v === "string" && enums) {
        if (v in enums) return enums[v];
        const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        if (cap in enums) return enums[cap];
    }
    return enums?.Mod ?? "Mod";
}

function isConsumableType(v: string | number | undefined): boolean {
    if (v === "Consumable" || v === "consumable") return true;
    if (typeof v === "number") return v === g()?.enums?.ItemType?.Consumable;
    return false;
}

function registerI18n(map: Record<string, string>) {
    if (Object.keys(map).length) api.i18n.register("en", map);
}

const NEUTRAL_VARIANT: [number, number, number, number] = [204, 204, 204, 255];

function variantFromMetaColor(metaColor: unknown): [number, number, number, number] {
    if (typeof metaColor !== "number" || !Number.isFinite(metaColor)) return NEUTRAL_VARIANT;
    const packed = Math.max(0, Math.min(0xffffff, Math.floor(metaColor)));
    return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255];
}

export function normalizeElementPatch(entry: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...entry };
    const mt = resolveMatterType(entry.matterType as string | number | undefined);
    if (mt !== undefined) out.matterType = mt;
    const rawColors = entry.colors as { variants?: unknown } | number[][] | undefined;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else if (entry.metaColor !== undefined) {
        out.colors = { variants: [variantFromMetaColor(entry.metaColor)] };
    }
    if (typeof entry.getExtraProps !== "function") delete out.getExtraProps;
    return out;
}

function normalizeElement(def: ElementConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `elements|${id}|name`;
    const out: Record<string, unknown> = { ...def, id, name, nameKey };
    const mt = resolveMatterType(def.matterType as string | number | undefined);
    if (mt !== undefined) out.matterType = mt;

    const rawColors = def.colors as { variants?: unknown } | number[][] | undefined;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else {
        out.colors = Array.isArray(rawColors) || !rawColors
            ? { variants: [variantFromMetaColor(def.metaColor)] }
            : { ...rawColors, variants: [variantFromMetaColor(def.metaColor)] };
    }
    if (typeof def.getExtraProps !== "function") delete out.getExtraProps;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `elements|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}

function normalizeStructure(def: StructureConfig): Record<string, unknown> & {
    registerOptions?: { useRawShape?: boolean };
} {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `structures|${id}|name`;
    const out: Record<string, unknown> = {
        ...def,
        id,
        name,
        nameKey,
        categoryKey: def.categoryKey ?? "blocks",
        buildModes: def.buildModes ?? [{ type: "single" }],
        variants: def.variants ?? [{ id, angles: [0] }],
    };
    if (typeof def.draw !== "function") delete out.draw;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `structures|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    const registerOptions = def.registerOptions;
    delete out.registerOptions;
    return { ...out, registerOptions };
}

export interface CompiledItemAction {
    fn: unknown;
    skipped: string[];
    source:
        | { kind: "none" }
        | { kind: "process"; id: string };
}

let compileItemAction: ((def: Record<string, unknown>) => CompiledItemAction) | null = null;

export function setItemActionCompiler(
    fn: (def: Record<string, unknown>) => CompiledItemAction,
): void {
    compileItemAction = fn;
}

function normalizeItem(def: ItemConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `items|${id}|name`;
    const itemType = resolveItemType(def.itemType ?? def.type);
    const isConsumable = isConsumableType(def.itemType ?? def.type);
    const out: Record<string, unknown> = { ...def, id, name, nameKey, itemType, type: itemType };
    if (!out.sprite || typeof out.sprite !== "object" || !(out.sprite as any).id) {
        out.sprite = {
            id: `${id}-sprite`,
            type: (def.sprite as any)?.type ?? "onehand",
            ...(typeof def.sprite === "object" ? def.sprite : {}),
        };
        if (!(out.sprite as any).id) (out.sprite as any).id = `${id}-sprite`;
    }
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `items|${id}|description`;
    }

    if (!compileItemAction) {
        throw new Error(
            `${LOG} items.register needs the process compiler; nothing called ` +
                `setItemActionCompiler. Import packages/mysandkit.ts before registering.`,
        );
    }
    const compiled = compileItemAction(def as Record<string, unknown>);
    if (compiled.source.kind !== "none" && !isConsumable) {
        if (compiled.skipped.length) {
            console.warn(
                `[md-my-hown-mod] item ${id}: unknown action ${compiled.skipped.join(", ")}`,
            );
        }
        out.handleAction = compiled.fn as never;

        if (compiled.source.kind === "process") out.processId = compiled.source.id;
        out.options = {
            ...(typeof def.options === "object" ? def.options : {}),
            itemId: id,
            itemType: def.itemType ?? "Mod",
        };
    } else {
        for (const k of ["actions", "handlerKey", "onUpgradeKey"]) delete out[k];
        delete out.options;
    }

    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}
