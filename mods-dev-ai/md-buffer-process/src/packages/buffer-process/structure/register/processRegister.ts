/**
 * Process structures — hidden from the game build menu, placed via buffer picker.
 *
 *   hideFromBuildMenu: true
 *   type id:  modId:item/<catalogueItemId>  (same scheme as buffer-controls)
 *
 * 1 cell processed → ±1 on JsonMapBuffer. eatCount/emitCount default 16.
 */
import "@sandmd/sandkit";
import type {
    ProcessDefinition,
    ProcessMapBuffer,
} from "../../types.ts";
import { PROCESS_CELL_MAX, PROCESS_SIZE } from "../../types.ts";
import {
    actionPath,
    readCounter,
    resolveActif,
    runAction,
} from "../../ops.ts";
import {
    buildProcessData,
    buildProcessRender,
    buildProcessTooltips,
    makeProcessShape,
    sectionBuildSingle,
} from "../defBuilders.ts";

interface StructurePos {
    x: number;
    y: number;
    data?: Record<string, unknown>;
    type?: string | number;
}

export interface ProcessRegisterResult {
    structureId: string;
    processorId: string;
}

function resolveElementType(elm: string | null | undefined): number | null {
    if (!elm) return null;
    const api = sandkit.api;
    try {
        const t =
            api.elements.getTypeFromId?.(elm) ??
            api.elements.getTypeById?.(elm);
        return typeof t === "number" ? t : null;
    } catch {
        return null;
    }
}

function clampCount(n: number | undefined, fallback: number): number {
    const v = n ?? fallback;
    return Math.max(1, Math.min(PROCESS_CELL_MAX, Math.floor(v)));
}

function* interiorCellsBottomFirst(
    sx: number,
    sy: number,
): Generator<{ x: number; y: number }> {
    for (let dy = PROCESS_SIZE - 1; dy >= 0; dy--) {
        for (let dx = 0; dx < PROCESS_SIZE; dx++) {
            yield { x: sx + dx, y: sy + dy };
        }
    }
}

function cellHasElement(
    x: number,
    y: number,
    elmType: number,
    elmId: string,
): boolean {
    const api = sandkit.api;
    try {
        if (api.elements.isTypeAtCell?.(x, y, elmId)) return true;
        if (api.elements.isTypeAtCell?.(x, y, elmType)) return true;
    } catch { /* fall through */ }
    try {
        const t = api.elements.getTypeAtCell?.(x, y);
        if (t === elmType) return true;
        const resolved = api.elements.getResolvedTypeAtCell?.(x, y);
        if (resolved === elmType) return true;
    } catch { /* best-effort */ }
    return false;
}

function removeElementAt(x: number, y: number): void {
    const api = sandkit.api;
    try {
        if (typeof api.elements.removeAtCellWhenIdle === "function") {
            api.elements.removeAtCellWhenIdle(x, y);
            return;
        }
    } catch { /* fall through */ }
    try {
        api.elements.removeAtCell(x, y);
    } catch { /* best-effort */ }
}

function replaceWithResidu(x: number, y: number, residuType: number): void {
    const api = sandkit.api;
    try {
        if (typeof api.elements.replaceAtCellWhenIdle === "function") {
            api.elements.replaceAtCellWhenIdle(x, y, residuType);
            return;
        }
    } catch { /* fall through */ }
    try {
        if (typeof api.elements.replaceAtCell === "function") {
            api.elements.replaceAtCell(x, y, residuType);
            return;
        }
    } catch { /* fall through */ }
    try {
        removeElementAt(x, y);
        if (typeof api.elements.createAtCellWhenIdle === "function") {
            api.elements.createAtCellWhenIdle(x, y, residuType);
        } else {
            api.elements.createAtCell(x, y, residuType);
        }
    } catch { /* best-effort */ }
}

function isCellEmpty(x: number, y: number): boolean {
    const api = sandkit.api;
    try {
        if (typeof api.grid?.isCellEmptyAtCell === "function") {
            return api.grid.isCellEmptyAtCell(x, y);
        }
    } catch { /* fall through */ }
    try {
        const t = api.elements.getTypeAtCell?.(x, y);
        return t === null || t === undefined || t === 0;
    } catch {
        return true;
    }
}

export function registerProcessStructure(
    def: ProcessDefinition,
    map: ProcessMapBuffer,
): ProcessRegisterResult {
    const api = sandkit.api;
    const elmId = def.elm ?? null;
    const elmType = resolveElementType(elmId);
    const residuId = def.residu ?? null;
    const residuType = resolveElementType(residuId);
    const eatCount = clampCount(def.eatCount, PROCESS_CELL_MAX);
    const emitCount = clampCount(def.emitCount, PROCESS_CELL_MAX);
    const eatMax = def.eatMax ?? null;
    const counterPath = actionPath(def.action);
    const spriteSize = def.spriteSize ?? { width: 16, height: 16 };

    const actifFn = resolveActif(def.actif, map);

    // Hidden from game build menu — only available via buffer catalogue picker.
    const structureDef: Record<string, unknown> = {
        id: def.id,
        name: def.name,
        description: def.description ?? def.name,
        categoryKey: def.categoryKey ?? "blocks",
        order: def.order ?? 50,
        alwaysUnlocked: false,
        hideFromBuildMenu: true,
        shape: makeProcessShape(),
        ...sectionBuildSingle(def.id),
        ...buildProcessData(def.id),
        ...buildProcessRender(def.spriteId, spriteSize),
        ...buildProcessTooltips(),
    };

    console.log(`[process] register (picker-only) ${def.id}`);
    api.structures.register(structureDef);
    // Unlock so the picker / build tool can select it; still hidden from menu.
    try {
        api.player.buildings.unlockByType(def.id);
    } catch (err) {
        console.warn(`[process] unlockByType failed ${def.id}`, err);
    }

    const structureType =
        api.structures.getTypeFromId?.(def.id) ??
        api.structures.getTypeById?.(def.id) ??
        def.id;

    const processFn = (structure: StructurePos) => {
        try {
            if (!actifFn()) return;

            if (
                eatMax !== null &&
                counterPath !== null &&
                readCounter(map, counterPath) >= eatMax
            ) {
                return;
            }

            const sx = structure.x;
            const sy = structure.y;

            if (elmId && elmType !== null) {
                let eaten = 0;
                for (const cell of interiorCellsBottomFirst(sx, sy)) {
                    if (eaten >= eatCount) break;
                    if (!cellHasElement(cell.x, cell.y, elmType, elmId)) continue;
                    removeElementAt(cell.x, cell.y);
                    eaten++;
                }
                if (eaten === 0) return;
                runAction(def.action, map, eaten);
                return;
            }

            if (!residuId || residuType === null) return;

            let available = emitCount;
            if (counterPath !== null) {
                const cur = readCounter(map, counterPath);
                if (cur <= 0) return;
                available = Math.min(available, cur);
            }
            if (available <= 0) return;

            const targets: { x: number; y: number }[] = [];
            for (const cell of interiorCellsBottomFirst(sx, sy)) {
                if (targets.length >= available) break;
                if (isCellEmpty(cell.x, cell.y)) targets.push(cell);
            }
            if (targets.length === 0) {
                for (const cell of interiorCellsBottomFirst(sx, sy)) {
                    if (targets.length >= available) break;
                    targets.push(cell);
                }
            }

            let emitted = 0;
            for (const cell of targets) {
                if (emitted >= available) break;
                const ok = runAction(def.action, map, 1);
                if (!ok) break;
                replaceWithResidu(cell.x, cell.y, residuType);
                emitted++;
            }
        } catch (err) {
            console.error(`[process] tick failed ${def.id}`, err);
        }
    };

    const processorId = `${def.id}:process`;
    let registered = false;
    try {
        if (typeof api.structures.addProcessor === "function") {
            api.structures.addProcessor(structureType, {
                intervalMs: def.intervalMs,
                process: processFn,
            });
            registered = true;
        }
    } catch (err) {
        console.error(`[process] addProcessor failed ${def.id}`, err);
    }
    if (!registered) {
        try {
            api.structures.processing.register(processorId, {
                structureType: def.id,
                intervalMs: def.intervalMs,
                process: processFn,
            });
        } catch (err) {
            console.error(`[process] processing.register failed ${def.id}`, err);
        }
    }

    return { structureId: def.id, processorId };
}
