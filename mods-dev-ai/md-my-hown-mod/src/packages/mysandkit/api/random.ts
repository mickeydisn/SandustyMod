import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const random = {
    int(min: number, max: number): number | undefined {
        try {
            return g()?.api?.random?.int?.(min, max) as number | undefined;
        } catch (e) {
            console.warn(`${LOG} random.int failed`, min, max, e);
            return min;
        }
    },
};
