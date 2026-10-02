import { api } from "../../packages/mysandkit.ts";

export interface Cell {
    x: number;
    y: number;
}

export interface CellRegion {
    x: number;

    y: number;

    width: number;

    height: number;

    mask: number[][];
}

export type ShapeMatrix = number[][];

export interface Size {
    width: number;
    height: number;
}

function sane(value: number, max: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
}

export function footprint(x: number, y: number, shape?: ShapeMatrix | null): CellRegion {
    if (!Array.isArray(shape) || shape.length === 0) {
        return { x, y, width: 1, height: 1, mask: [[1]] };
    }

    const width = sane(
        Math.max(...shape.map((r) => (Array.isArray(r) ? r.length : 0))),
        MAX_SCAN_SIDE,
    );

    if (width === 0) return { x, y, width: 1, height: 1, mask: [[1]] };
    const height = sane(shape.length, MAX_SCAN_SIDE);
    const mask = Array.from({ length: height }, (_, row) => {
        const cells = shape[row];
        return Array.from(
            { length: width },
            (_, col) => (Array.isArray(cells) ? Number(cells[col]) || 0 : 0),
        );
    });
    return { x, y, width, height, mask };
}

export function shapeSize(shape: ShapeMatrix | undefined | null): Size {
    const region = footprint(0, 0, shape);
    return { width: region.width, height: region.height };
}

export function cellAt(region: CellRegion, col: number, row: number): Cell {
    return { x: region.x + col, y: region.y + row };
}

export function cellsOf(region: CellRegion): Cell[] {
    const out: Cell[] = [];
    for (let row = 0; row < region.height; row++) {
        for (let col = 0; col < region.width; col++) {
            if (region.mask[row]?.[col] !== 0) out.push(cellAt(region, col, row));
        }
    }
    return out;
}

export interface Anchor {
    x: number;
    y: number;

    source: "payload" | "cursor" | "none";
}

function coord(value: unknown): number | undefined {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function anchorFor(payload: unknown): Anchor {
    const x = coord(readProp(payload, "x"));
    const y = coord(readProp(payload, "y"));
    if (x !== undefined && y !== undefined) return { x, y, source: "payload" };

    try {
        const cursor = api.input.getMouseCellPosition();
        const cx = coord(readProp(cursor, "x"));
        const cy = coord(readProp(cursor, "y"));
        if (cx !== undefined && cy !== undefined) return { x: cx, y: cy, source: "cursor" };
    } catch {
    }
    return { x: 0, y: 0, source: "none" };
}

function readProp(source: unknown, key: string): unknown {
    if (source === null || (typeof source !== "object" && typeof source !== "function")) {
        return undefined;
    }
    try {
        return (source as Record<string, unknown>)[key];
    } catch {
        return undefined;
    }
}

export const MAX_SCAN_SIDE = 64;
