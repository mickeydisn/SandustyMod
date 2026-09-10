/**
 * Neighbourhood queries over the 8 compass headings — "is anything X near this
 * cell" style checks used by the growth actions.
 */
import { DELTAS_INDEX, type IDelta, type TElementType } from "@sandmd/types";
import { Grid } from "./grid.ts";

export const GridNear = {
    isNearEmpty(
        x: number,
        y: number,
        deltas: IDelta[] = DELTAS_INDEX,
    ): boolean {
        for (const d of deltas) {
            if (Grid.isEmptyAt(x + d.x, y + d.y)) return true;
        }
        return false;
    },

    isNear(
        x: number,
        y: number,
        includeType: TElementType[] | TElementType,
        deltas: IDelta[] = DELTAS_INDEX,
    ): boolean {
        for (const d of deltas) {
            if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) return true;
        }
        return false;
    },

    isNotNear(
        x: number,
        y: number,
        excludeType: TElementType[] | TElementType,
        deltas: IDelta[] = DELTAS_INDEX,
    ): boolean {
        for (const d of deltas) {
            if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) return true;
        }
        return false;
    },

    countNearEmpty(
        x: number,
        y: number,
        deltas: IDelta[] = DELTAS_INDEX,
    ): number {
        let n = 0;
        for (const d of deltas) {
            if (Grid.isEmptyAt(x + d.x, y + d.y)) n++;
        }
        return n;
    },

    countNear(
        x: number,
        y: number,
        includeType: TElementType[] | TElementType,
        deltas: IDelta[] = DELTAS_INDEX,
    ): number {
        let n = 0;
        for (const d of deltas) {
            if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) n++;
        }
        return n;
    },

    countNotNear(
        x: number,
        y: number,
        excludeType: TElementType[] | TElementType,
        deltas: IDelta[] = DELTAS_INDEX,
    ): number {
        let n = 0;
        for (const d of deltas) {
            if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) n++;
        }
        return n;
    },
};
