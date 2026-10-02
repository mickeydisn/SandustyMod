import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const effectsActions = defineActions({
    particles: {
        role: "feel",
        needs: ["pos"],
        doc: "Emits particles here. Set `count` in options.",
        type: "message",
        slots: ["signal", "processing", "modifier"],
        scope: "cell",
        params: [
        p("name", "Effect", "text", { required: true, hint: "effect name" }),
        p("count", "Count", "number", { def: "1", min: 0, max: 999 }),
        ],
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
