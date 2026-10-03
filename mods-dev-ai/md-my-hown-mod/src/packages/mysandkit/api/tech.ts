import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const tech = {
    registerDefinition(id: string, body: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.tech;
            const fn = ns?.registerDefinition ?? ns?.addDefinition;
            if (typeof fn !== "function") return false;
            fn.call(ns, id, body);
            return true;
        } catch (e) {
            console.error(`${LOG} tech.registerDefinition failed`, id, e);
            return false;
        }
    },
    registerNode(
        id: string,
        body: Record<string, unknown>,
        opts: Record<string, unknown>,
    ): boolean {
        try {
            const ns = g()?.api?.tech;
            if (typeof ns?.registerNode !== "function") return false;
            ns.registerNode(id, body, opts);
            return true;
        } catch (e) {
            console.warn(`${LOG} tech.registerNode failed`, id, e);
            return false;
        }
    },
    updateDefinition(id: string, partial: Record<string, unknown>): void {
        try {
            g()?.api?.tech?.updateDefinition?.(id, partial);
        } catch (e) {
            console.error(`${LOG} tech.updateDefinition failed`, id, e);
        }
    },

    conservatory: {
        appendUnlock(techId: string, unlocks: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.tech?.conservatory;
                if (typeof ns?.appendUnlock !== "function") return false;
                ns.appendUnlock(techId, unlocks);
                return true;
            } catch (e) {
                console.warn(`${LOG} tech.conservatory.appendUnlock failed`, techId, e);
                return false;
            }
        },
    },
};
