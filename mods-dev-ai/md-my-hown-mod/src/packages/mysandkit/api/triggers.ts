import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const triggers = {
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
};
