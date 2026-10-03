import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const excavation = {
    registerProfile(id: string, payload: unknown): boolean {
        try {
            const ns = g()?.api?.excavation;
            if (typeof ns?.registerProfile !== "function") return false;
            ns.registerProfile(id, payload);
            return true;
        } catch (e) {
            console.error(`${LOG} excavation.registerProfile failed`, id, e);
            return false;
        }
    },
};
