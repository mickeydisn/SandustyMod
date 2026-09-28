/**
 * DECIDE — ask a question.
 *
 * A DECIDE action computes a truth value and writes it to `proceed`. A `false`
 * value **skips every later action in the process** — see `HandlerAction.md` §8
 * for why the gate is sticky and why there is deliberately no `else`.
 *
 * This is the thinnest folder and the most important one. It is what turns a
 * process from a fixed recipe into something that reacts, and every other role
 * only becomes *optional* once this folder has something in it.
 *
 * See `HandlerAction.md` §3.
 *
 * @module
 */
import { defineActions } from "../../core/types.ts";

export const decideActions = defineActions({
    /**
     * The identity condition — always true.
     *
     * Its real job is to make an empty decision list *explicit*. A process that
     * contains only ACT actions runs unconditionally; adding this one says so.
     */
    noop: {
        role: "decide",
        doc: "Always true. Makes an unconditional process explicit.",
        fn: () => undefined,
    },

    /**
     * Maps a value through thresholds, so a stored number becomes a decision.
     *
     * Not a yes/no itself — it is the arithmetic a DECIDE action composes with,
     * kept here because every use of it is a threshold test.
     */
    upgradeScale: {
        role: "decide",
        doc: "Maps a stored value through thresholds. Set `thresholds` in options.",
        fn: (payload, _ctx, options) => {
            const o = options as { thresholds?: number[] } | null;
            const value = (payload as { data?: Record<string, unknown> } | null)?.data
                ?.level;
            const t = o?.thresholds ?? [];
            console.log("[md-my-hown-mod:decide] scale", value, t);
        },
    },
});
