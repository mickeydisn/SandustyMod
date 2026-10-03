import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const reactions = {
    registerContact(def: Record<string, unknown>): void {
        try {
            g()?.api?.reactions?.registerContact?.(def);
        } catch (e) {
            console.error(`${LOG} reactions.registerContact failed`, e);
        }
    },
};
