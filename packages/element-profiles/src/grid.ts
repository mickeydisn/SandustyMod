/**
 * Thin read/write adapter over the engine's per-cell element API (worker side).
 * All engine access is guarded/try-caught so a single bad cell read never
 * breaks the profile loop.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/shared";

export const Grid = {
    // TYPE
    getTypeAt(x: number, y: number): number {
        return sandkit.api.elements.getResolvedTypeAtCell(x, y);
    },

    isEmptyAt(x: number, y: number): boolean {
        try {
            if (typeof sandkit.api.grid.isCellEmptyAtCell === "function") {
                return sandkit.api.grid.isCellEmptyAtCell!(x, y);
            }
        } catch {
            /* ignore */
        }
        const t = sandkit.api.elements.getTypeAtCell(x, y);
        return t == null || t === 0;
    },

    isTypeAt(
        x: number,
        y: number,
        includeType: TElementType[] | TElementType,
    ): boolean {
        const t = this.getTypeAt(x, y);
        if (t == null || t === 0) return false;
        const include = typeof includeType === "number" ? [includeType] : includeType;
        return include.includes(t);
    },

    isNotTypeAt(
        x: number,
        y: number,
        excludeTypes: TElementType[] | TElementType,
    ): boolean {
        if (Grid.isEmptyAt(x, y)) return true;
        const t = Grid.getTypeAt(x, y);
        if (t == null || t === 0) return true;
        const exclude = typeof excludeTypes === "number" ? [excludeTypes] : excludeTypes;
        return !exclude.includes(t);
    },

    // DATA
    readFieldAt(x: number, y: number, field: number): number {
        try {
            const v = sandkit.api.elements.getDataFieldAtCell(x, y, field);
            return v == null || v < 0 ? 0 : v;
        } catch {
            return 0;
        }
    },
    writeFieldAt(x: number, y: number, field: number, value: number): void {
        try {
            sandkit.api.elements.setDataFieldAtCell(x, y, field, value);
        } catch {
            /* ignore */
        }
    },
    resetFieldAt(x: number, y: number, field: number): void {
        Grid.writeFieldAt(x, y, field, 0);
    },

    // MOVE
    swapCell(
        x: number,
        y: number,
        nx: number,
        ny: number,
        liquidType: TElementType | null,
    ): { x: number; y: number } | null {
        if (liquidType == null || !Grid.isTypeAt(nx, ny, liquidType)) return null;
        try {
            if (sandkit.api.elements.swapCells?.(x, y, nx, ny) === true) {
                return { x: nx, y: ny };
            }
        } catch {
            /* ignore */
        }
        try {
            if (sandkit.api.elements.moveBetweenCells?.(x, y, nx, ny) === true) {
                return { x: nx, y: ny };
            }
        } catch {
            /* ignore */
        }
        return null;
    },
};
