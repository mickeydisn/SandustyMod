import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const ui = {
    overlays: {
        register(zone: string, id: string, component: unknown, opts?: Record<string, unknown>) {
            try {
                {
                    const React = g()?.react;
                    const render = typeof component === "function" && component.length === 0
                        ? component
                        : () => (React ? React.createElement(component as any) : null);
                    g()?.api?.ui?.overlays?.register?.(zone, id, render);
                }
            } catch (e) {
                console.error(`${LOG} ui.overlays.register failed`, id, e);
            }
        },
        unregister(zone: string, id: string) {
            try {
                g()?.api?.ui?.overlays?.unregister?.(zone, id);
            } catch {}
        },
    },

    toast(message: string): void {
        try {
            (g()?.api?.ui?.toast as ((m: string) => void) | undefined)?.(message);
        } catch (e) {
            console.warn(`${LOG} ui.toast failed`, message, e);
        }
    },
};
