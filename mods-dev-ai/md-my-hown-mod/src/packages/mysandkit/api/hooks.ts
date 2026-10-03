import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const hooks = {
    hasHooks(): boolean {
        try {
            return !!g()?.api?.hooks;
        } catch {
            return false;
        }
    },
    intercept(
        id: string,
        fn: (args: never, context: { cancel?: () => void }) => unknown,
        opts?: Record<string, unknown>,
    ): unknown {
        try {
            return g()?.api?.hooks?.intercept?.(id, fn, opts);
        } catch (e) {
            console.error(`${LOG} hooks.intercept failed`, id, e);
            return undefined;
        }
    },

    modify(
        id: string,
        fn: (args: never, context: { cancel?: () => void }) => unknown,
        opts?: Record<string, unknown>,
    ): unknown {
        try {
            return g()?.api?.hooks?.modify?.(id, fn, opts);
        } catch (e) {
            console.error(`${LOG} hooks.modify failed`, id, e);
            return undefined;
        }
    },
};
