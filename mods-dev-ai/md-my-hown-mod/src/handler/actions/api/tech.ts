import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";
export const techActions = defineActions({
    techAppendUnlock: {
        role: "connect",
        doc: "Adds structures to a tech node. Set `techId` and `structures` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as {
                techId?: unknown;
                structures?: string[];
                items?: string[];
            };
            const self = (payload as { id?: string } | null)?.id;
            const structures = o.structures ?? (self ? [self] : []);
            
            
            
            const techId = typeof o.techId === "string" ? o.techId : "";
            if (!techId || structures.length === 0) return;
            
            
            const unlocks: Record<string, unknown> = { structures };
            if (o.items) unlocks.items = o.items;
            
            
            
            
            if (!api.tech.conservatory.appendUnlock(techId, unlocks)) {
                console.warn(
                    "[md-my-hown-mod:connect] tech.conservatory.appendUnlock refused " +
                        `${techId} — no unlock was added`,
                );
            }
        },
    },

    

});
