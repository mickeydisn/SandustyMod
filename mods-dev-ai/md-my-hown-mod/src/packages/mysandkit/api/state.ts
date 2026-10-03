import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const state = {
    get store(): Record<string, any> | undefined {
        try {
            return g()?.state?.store as Record<string, any> | undefined;
        } catch (e) {
            console.warn(`${LOG} state.store failed`, e);
            return undefined;
        }
    },
};
