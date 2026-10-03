import { g } from "../host.ts";

export const events = {
    on(name: string, cb: (...args: any[]) => void): (() => void) | void {
        try {
            return g()?.api?.events?.on?.(name, cb);
        } catch {
            return undefined;
        }
    },
};
