import { g } from "../host.ts";

export const core = {
    get raw() {
        return g()?.api;
    },
    get host() {
        return g();
    },
    get enums() {
        return g()?.enums;
    },
    get react() {
        return g()?.react;
    },
    get mods() {
        return g()?.mods;
    },
    toast(msg: string, opts?: Record<string, unknown>) {
        try {
            g()?.api?.ui?.toast?.(msg, opts ?? {});
        } catch {}
    },
};
