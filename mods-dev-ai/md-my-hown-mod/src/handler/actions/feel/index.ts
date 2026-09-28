/**
 * FEEL — feedback the player can see or hear.
 *
 * A FEEL action produces no state. It is what makes a mod feel finished rather
 * than merely working, and it is the folder our catalogue was **emptiest** in:
 * every one of the original "log" actions were really this role, filed under
 * whatever bag their signature put them in.
 *
 * None of the engine's presentation calls are wrapped yet. All are current
 * (nothing here is `@deprecated` — see `HandlerAction.md` §9):
 *
 * | effect      | call                                     |
 * | ----------- | ---------------------------------------- |
 * | particles   | `effects.createParticlesAtWorld`         |
 * | light       | `effects.createLightAtWorld`, `lights.fadeAtWorld` |
 * | a laser     | `effects.createLaserAtWorld`             |
 * | a shockwave | `effects.createDistortionWaveAtWorld`    |
 * | sound       | `sound.play`                             |
 * | a message   | `ui.toast`                               |
 * | refresh     | `rendering.redrawAroundCell`             |
 *
 * Roughly one line each. `ui.toast` matters twice over: once as player feedback,
 * and once as **author** feedback, because a refused write or a failed action
 * should be visible rather than silent.
 *
 * See `HandlerAction.md` §6.
 *
 * @module
 */
import { defineActions, hostNs } from "../../core/types.ts";

export const feelActions = defineActions({
    /**
     * Says something on screen.
     *
     * The one FEEL action worth having first: it is both the cheapest way to make
     * a mod feel alive and the way an author learns that something did not work.
     */
    toast: {
        role: "feel",
        doc: "Shows a message. Set `text` in options.",
        fn: (_payload, _ctx, options) => {
            const text = (options as { text?: string } | null)?.text;
            if (!text) return;
            try {
                hostNs("ui")?.toast?.(text);
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] toast failed", e);
            }
        },
    },

    /** Emits particles at the action's position. */
    particles: {
        role: "feel",
        doc: "Emits particles here. Set `name` and `count` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { name?: string; count?: number };
            const p = payload as { x?: number; y?: number } | null;
            if (!p || !o.name) return;
            try {
                hostNs("effects")?.createParticlesAtWorld?.(
                    o.name,
                    p.x,
                    p.y,
                    o.count ?? 1,
                );
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] particles failed", e);
            }
        },
    },

    /**
     * Prints the upgraded item and this action's options.
     *
     * Safe to leave on while testing an upgrade: it writes nothing, so the worst
     * it can do is noise. That is the whole point of a FEEL action.
     */
    upgradeLog: {
        role: "feel",
        doc: "Prints the upgraded item and these options. Safe to leave on while testing.",
        fn: (payload, _ctx, options) => {
            console.log("[md-my-hown-mod:upgrade]", payload, options);
        },
    },
});
