import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const rendering = {
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
};
