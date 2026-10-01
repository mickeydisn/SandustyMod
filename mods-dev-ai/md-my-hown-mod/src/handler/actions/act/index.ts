
import { anchorFor } from "../../core/cell-region.ts";
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";


export interface ProcessingContext {
    getResolvedTypeAtCell?: (x: number, y: number) => unknown;
    isCellEmptyAtCell?: (x: number, y: number) => boolean;
    
    commit?: (mutations: CellMutation[]) => boolean | void;
}


export interface CellMutation {
    kind: "create" | "remove" | "structure";
    cellX: number;
    cellY: number;
    elementType?: unknown;
    
    expectedElementType?: unknown;
}


function commitOrWarn(
    context: unknown,
    mutations: CellMutation[],
    label: string,
): boolean {
    const ctx = context as ProcessingContext | null;
    if (!ctx?.commit) {
        console.warn(
            `[md-my-hown-mod:act] ${label}: this call site hands over no cell ` +
                "context, so nothing was written",
        );
        return false;
    }
    try {
        
        
        const ok = ctx.commit(mutations);
        if (ok === false) {
            console.warn(
                `[md-my-hown-mod:act] ${label}: the engine refused the write — ` +
                    "the cell was probably occupied or changed mid-tick",
            );
        }
        return ok !== false;
    } catch (e) {
        console.warn(`[md-my-hown-mod:act] ${label} failed`, e);
        return false;
    }
}


function at(
    structure: { x?: number; y?: number } | null,
    dx: number,
    dy: number,
): { cellX: number; cellY: number } {
    return { cellX: (structure?.x ?? 0) + dx, cellY: (structure?.y ?? 0) + dy };
}





export const actActions = defineActions({
    
    itemExcavate: {
        role: "act",
        doc: "Digs at this position. Set `damage` and `velocity` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { damage?: number; vx?: number; vy?: number };
            
            
            
            
            
            
            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemExcavate: this call site gave no position and " +
                        "there is no cursor to read, so nothing was dug",
                );
                return;
            }
            try {
                api.grid.excavateAtCell(
                    at.x,
                    at.y,
                    { x: o.vx ?? 0, y: o.vy ?? 0 },
                    o.damage ?? 1,
                );
            } catch (e) {
                console.warn("[md-my-hown-mod:act] excavate failed", e);
            }
        },
    },

    
    itemShoot: {
        role: "act",
        doc: "Fires a projectile. Set `projectileId` and `velocity` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { projectileId?: string; vx?: number; vy?: number };
            if (!o.projectileId) return;
            
            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemShoot: this call site gave no position and " +
                        "there is no cursor to read, so nothing was fired",
                );
                return;
            }
            try {
                
                
                
                
                
                
                
                
                
                
                
                const blueprint = api.projectiles.createBlueprintFromId(o.projectileId);
                if (!blueprint) {
                    console.warn(
                        `[md-my-hown-mod:act] itemShoot: no projectile registered as ` +
                            `"${o.projectileId}", so nothing was fired`,
                    );
                    return;
                }
                const vx = o.vx ?? 0;
                const vy = o.vy ?? 0;
                
                
                
                const angle = vx === 0 && vy === 0 ? 0 : Math.atan2(vy, vx);
                api.projectiles.spawnAtWorld(at.x, at.y, angle, blueprint);
            } catch (e) {
                console.warn("[md-my-hown-mod:act] shoot failed", e);
            }
        },
    },
});








export const processingActActions = defineActions({
    
    processorLog: {
        role: "act",
        doc: "Logs the structure and cell context on every run. Use to confirm wiring.",
        fn: (structure, context) => {
            console.log("[md-my-hown-mod:process]", structure, context);
        },
    },

    
    processorNoop: {
        role: "act",
        doc: "Does nothing. Keeps the interval alive without side effects.",
        fn: () => {},
    },

    
    processorLift: {
        role: "act",
        doc: "Copies the cell above the structure down to the cell below.",
        fn: (structure, context) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const dst = at(s, 0, 1);
                const elementType = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (elementType === undefined || elementType === null) return;
                commitOrWarn(context, [
                    { kind: "remove", ...src, expectedElementType: elementType },
                    { kind: "create", ...dst, elementType },
                ], "lift");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] lift failed", e);
            }
        },
    },

    
    processorConvert: {
        role: "act",
        doc: "Replaces the cell above with one fixed element. Set `to` in options.",
        fn: (structure, context, options) => {
            try {
                const s = structure as { x?: number; y?: number } | null;
                const ctx = context as ProcessingContext | null;
                const target = (options as { to?: unknown } | null)?.to;
                if (!s || !ctx?.getResolvedTypeAtCell) return;
                const src = at(s, 0, -1);
                const current = ctx.getResolvedTypeAtCell(src.cellX, src.cellY);
                if (current === undefined || current === null) return;
                if (target === undefined || target === null) {
                    console.log("[md-my-hown-mod:process] convert sees", current);
                    return;
                }
                
                
                
                commitOrWarn(context, [{ kind: "create", ...src, elementType: target }], "convert");
            } catch (e) {
                console.warn("[md-my-hown-mod:act] convert failed", e);
            }
        },
    },
});
