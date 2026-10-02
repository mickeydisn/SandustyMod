
import { defineActions } from "../../core/types.ts";
import { api } from "../../../packages/mysandkit.ts";

/** Feel actions that reach the host through `api.*`. */
export const feelActions = defineActions({
    
    toast: {
        role: "feel",
        doc: "Shows a message. Set `text` in options.",
        fn: (_payload, _ctx, options) => {
            const text = (options as { text?: string } | null)?.text;
            if (!text) return;
            try {
                api.ui.toast(text);
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] toast failed", e);
            }
        },
    },

    
    particles: {
        role: "feel",
        doc: "Emits particles here. Set `count` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { name?: string; count?: number };
            const p = payload as { x?: number; y?: number } | null;
            if (!p || !o.name || p.x === undefined || p.y === undefined) return;
            try {
                api.effects.createParticlesAtWorld(p.x, p.y, { count: o.count ?? 1 });
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] particles failed", e);
            }
        },
    },
});
