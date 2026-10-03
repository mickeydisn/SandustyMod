import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const settings = {
    get(fieldId: string): unknown {
        try {
            return g()?.api?.settings?.get?.(fieldId);
        } catch (e) {
            console.warn(`${LOG} settings.get failed`, fieldId, e);
            return undefined;
        }
    },

    onChange(cb: () => void): (() => void) | undefined {
        try {
            const unsub = g()?.api?.settings?.onChange?.(cb);
            return typeof unsub === "function" ? unsub : undefined;
        } catch (e) {
            console.warn(`${LOG} settings.onChange failed`, e);
            return undefined;
        }
    },
};
