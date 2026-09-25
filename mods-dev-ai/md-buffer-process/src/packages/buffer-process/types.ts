/**
 * Process structures — 4×4 solid footprint (catalogue buildings).
 *
 * Eating / emitting scan the structure interior (bottom-first).
 * **One cell processed = ±1 on the map-buffer counter.**
 * eatCount / emitCount only cap how many cells are handled per tick
 * (default 1 — not the whole 4×4 every tick).
 */

export const PROCESS_SIZE = 4;
export const PROCESS_CELL_MAX = PROCESS_SIZE * PROCESS_SIZE; // 16

/**
 * Handle to JsonMapBuffer (getPath + increment).
 */
export interface ProcessMapBuffer {
    getPath(path: string): unknown;
    increment(path: string, delta: number): number;
    decrement(path: string, delta: number): number;
    isCounter?(path: string): boolean;
}

export type ProcessOp = "inc" | "dec" | "incX" | "decX" | "gt0" | "always";

export type ProcessActif =
    | (() => boolean)
    | { path: string; op: "always" | "gt0" };

/**
 * Buffer mutation after cells are processed.
 * When declared as { path, op }, the engine applies ±processedCount
 * (one cell = one step). `delta` is ignored for per-cell mode.
 */
export type ProcessAction =
    | (() => boolean)
    | { path: string; op: "inc" | "dec" | "incX" | "decX" };

/**
 * One process structure definition.
 *
 * Catalogue building (categoryKey / order / alwaysUnlocked) — NOT a menu item.
 */
export interface ProcessDefinition {
    id: string;
    name: string;
    description?: string;
    /** Building-catalogue category (e.g. "production"). */
    categoryKey?: string;
    order?: number;
    alwaysUnlocked?: boolean;
    spriteId?: string;
    spriteSize?: { width: number; height: number };

    /** Gate — if false, tick is a no-op. */
    actif: ProcessActif;

    /** Cadence ms — api.structures.addProcessor. */
    intervalMs: number;

    /**
     * Element id to eat inside the 4×4 footprint.
     * null = no eating (emit-only).
     */
    elm?: string | null;

    /**
     * Max cells of `elm` to eat this tick (bottom-first).
     * Clamped 1..16. Default: **1** (one cell = +1 on counter).
     */
    eatCount?: number;

    /**
     * Soft cap — skip tick when counter path >= eatMax.
     * null = no soft cap (JsonMapBuffer max still applies).
     */
    eatMax?: number | null;

    /**
     * Buffer mutation. With { path, op }: applied once with delta =
     * number of cells actually processed this tick (cell = ±1).
     */
    action: ProcessAction;

    /**
     * Element id used when emitting (replace target cell).
     * null = no emit.
     */
    residu?: string | null;

    /**
     * Max cells to replace with residu this tick.
     * Clamped 1..16. Default: **1** (one cell = −1 on counter via action).
     */
    emitCount?: number;
}

export interface ProcessHandles {
    structureIds: string[];
    processorIds: string[];
}
