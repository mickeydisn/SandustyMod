import { api } from "../../../packages/mysandkit.ts";
import { ELEMENT_DATA_SLOTS } from "../../../ui/definition/data-fields.ts";
import { anchorFor, MAX_SCAN_SIDE } from "../../engine/cell-region.ts";
import {
    addressFor,
    type Position,
    positionsFor,
    type Range,
    walkFor,
} from "../../engine/position.ts";
import type { ProcessingContext } from "./processors.ts";

interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}

export interface ElementOptions {
    dx?: unknown;
    dy?: unknown;

    size?: unknown;

    from?: unknown;
    to?: unknown;

    element?: unknown;

    footprint?: unknown;

    mx?: unknown;
    my?: unknown;

    durationTicks?: unknown;

    density?: unknown;

    freeFalling?: unknown;

    vx?: unknown;
    vy?: unknown;

    slot?: unknown;

    slotValue?: unknown;
}

function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function anchorPosition(structure: StructureLike | null): Position | null {
    const anchor = anchorFor(structure);
    return anchor.source === "none" ? null : { x: anchor.x, y: anchor.y };
}

export function regionFor(
    structure: StructureLike | null,
    options: ElementOptions,
): { range: Range; clamped: boolean } | { error: string } {
    const at = anchorPosition(structure);
    if (!at) {
        return {
            error: "this call site delivered no position and there is no cursor to read, " +
                "so there is no cell to work on",
        };
    }
    const built = addressFor(structure, options, MAX_SCAN_SIDE);
    if ("conflict" in built) return { error: built.conflict.message };
    return { range: positionsFor(built.address, at), clamped: built.clamped };
}

export function walkRangeFor(
    structure: StructureLike | null,
    options: ElementOptions,
): { range: Range; clamped: boolean } | { error: string } {
    const at = anchorPosition(structure);
    if (!at) return { error: "no position and no cursor: a walk has no cells to visit" };
    const built = walkFor(at, structure, options, MAX_SCAN_SIDE);
    if ("conflict" in built) return { error: built.conflict.message };
    return { range: built.range, clamped: built.clamped };
}

export function clampNote(clamped: boolean, label: string): string {
    return clamped
        ? `[md-my-hown-mod:process] ${label}: range clamped to ${MAX_SCAN_SIDE}×${MAX_SCAN_SIDE} — the count below covers less than you asked for`
        : "";
}

export function elementOf(options: ElementOptions): string {
    return String(options.element ?? "");
}

export function dataSlotOf(options: ElementOptions): number {
    const n = Math.round(Number(options.slot));
    return Number.isInteger(n) && n >= 1 && n <= ELEMENT_DATA_SLOTS ? n : 0;
}

export function cellReaders(context: unknown): {
    readType: (x: number, y: number) => unknown;
    isEmpty: ((x: number, y: number) => boolean) | undefined;

    idOf: (found: unknown) => string;

    matches: (id: string) => (x: number, y: number) => boolean;

    holdsValue: (id: string) => (found: unknown) => boolean;
} | null {
    const ctx = context as ProcessingContext | null;

    const readType = typeof ctx?.getResolvedTypeAtCell === "function"
        ? ctx.getResolvedTypeAtCell
        : api.elements.getResolvedTypeAtCell;
    if (typeof readType !== "function") return null;
    const isEmpty = typeof ctx?.isCellEmptyAtCell === "function"
        ? ctx.isCellEmptyAtCell
        : api.grid.isCellEmptyAtCell;

    const forms = (id: string): Set<unknown> => {
        const set = new Set<unknown>([id]);
        try {
            const t = api.elements.getTypeFromId(id);
            if (t != null) set.add(t);
        } catch {
        }
        return set;
    };

    const idOf = (found: unknown): string => {
        if (found == null) return "";
        if (typeof found === "string") return found;
        try {
            const id = api.elements.getIdByType(found as number);
            if (typeof id === "string" && id) return id;
        } catch {
        }
        return String(found);
    };

    const holdsValue = (id: string) => {
        const want = forms(id);
        return (found: unknown) => found != null && want.has(found);
    };

    return {
        readType: readType as (x: number, y: number) => unknown,
        isEmpty: typeof isEmpty === "function"
            ? isEmpty as (x: number, y: number) => boolean
            : undefined,
        idOf,
        holdsValue,
        matches: (id: string) => {
            const test = holdsValue(id);
            return (x: number, y: number) => test(readType(x, y));
        },
    };
}

export interface ElementWriter {
    createAtCell: (x: number, y: number, type: string, options?: unknown) => void;
    replaceAtCell: (x: number, y: number, type: string, options?: unknown) => void;

    removeAtCell?: (x: number, y: number, options?: unknown) => void;
}

export function writeCells(
    structure: unknown,
    context: unknown,
    options: unknown,
    label: string,
    decide: (
        writer: ElementWriter,
        cell: { x: number; y: number },
        current: unknown,
        empty: boolean,
    ) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    const ctx = context as ProcessingContext | null;

    const readType = ctx?.getResolvedTypeAtCell;
    const isEmpty = ctx?.isCellEmptyAtCell;
    if (!s || typeof readType !== "function") {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no cell reader on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as ElementOptions;
    const resolved = regionFor(s, o);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error} — nothing was written`);
        return false;
    }
    const { range, clamped } = resolved;
    const note = clampNote(clamped, label);
    if (note) console.warn(note);
    const cells = range;

    const plan: { cell: { x: number; y: number }; current: unknown; empty: boolean }[] = [];
    for (const cell of cells) {
        const empty = isEmpty ? isEmpty(cell.x, cell.y) : false;
        plan.push({ cell, current: empty ? null : readType(cell.x, cell.y), empty });
    }

    const noop: ElementWriter = {
        createAtCell: () => {},
        replaceAtCell: () => {},
        removeAtCell: () => {},
    };
    let queued = 0;
    for (const step of plan) {
        if (decide(noop, step.cell, step.current, step.empty)) queued++;
    }
    if (queued === 0) return false;

    if (
        !api.grid.mutate((writer: { elements: ElementWriter }) => {
            for (const step of plan) {
                decide(writer.elements, step.cell, step.current, step.empty);
            }
        })
    ) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.grid.mutate on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    return true;
}

export function createOptions(options: ElementOptions): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    const ticks = num(options.durationTicks);
    if (ticks > 0) out.durationTicks = ticks;
    const density = Number(options.density);
    if (Number.isFinite(density) && density > 0) out.density = density;
    if (options.freeFalling === true) out.isFreeFalling = true;

    const vx = Number(options.vx);
    const vy = Number(options.vy);
    if (Number.isFinite(vx) && Number.isFinite(vy) && (vx !== 0 || vy !== 0)) {
        out.particle = { velocity: { x: vx, y: vy } };
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
