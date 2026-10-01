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
import { api, defineActions } from "../../core/types.ts";

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
                api?.ui?.toast?.(text);
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] toast failed", e);
            }
        },
    },

    /**
     * Emits particles at the action's position.
     *
     * `createParticlesAtWorld(worldX, worldY, options?)` is the real signature. The
     * old call was `(o.name, p.x, p.y, o.count)`, which passed a **string** as
     * `worldX` and a number where the options bag belongs; `count` was dropped.
     *
     * ## Why `name` is not forwarded
     *
     * This function has no effect-name parameter. The only string-ish field on
     * `ParticleEffectOptions` is `imageName`, and the engine's own `.d.ts` types it
     * as `string` — but passing a string was **measured** to throw
     * `Cannot read properties of undefined (reading 'image')`, so the declared type
     * is wrong or incomplete. A live matrix test:
     *
     * ```
     * (20, 20, { count: 3 })            → accepted
     * (20, 20)                           → accepted
     * (20, 20, { imageName: "spark" })   → THROWS
     * (20, 20, { imageName: "sand" })    → THROWS
     * sprites.getById("sand" | "stone" | "dirt" | "water" | "spark") → all undefined
     * ```
     *
     * `sprites.getById` returning `undefined` for every name means the
     * `LoadedSprite` route could not be confirmed either, so nothing is guessed:
     * only `count` is passed, which is verified to work. If `imageName` is
     * investigated further, `name` can be wired to it then.
     */
    particles: {
        role: "feel",
        doc: "Emits particles here. Set `count` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { name?: string; count?: number };
            const p = payload as { x?: number; y?: number } | null;
            if (!p || !o.name) return;
            try {
                api?.effects?.createParticlesAtWorld?.(p.x, p.y, { count: o.count ?? 1 });
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
