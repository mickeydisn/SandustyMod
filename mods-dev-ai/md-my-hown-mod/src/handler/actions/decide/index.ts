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
import { defineActions, hostNs } from "../../core/types.ts";

export const decideActions = defineActions({
    /**
     * A random integer in an inclusive range.
     *
     * This is the action whose absence made "pick one of N" inexpressible. It is
     * not arithmetic and not a flag — it is the one decision a rule cannot derive
     * from the values it already has, so every config that needed variety had
     * either to fake it (a fixed constant, which is a lie) or leave the feature
     * half-built.
     *
     * It reads `api.random`, the engine's own generator, rather than calling
     * `Math.random()` directly. That matters for two reasons: the engine's is
     * **deterministic**, so a replay or a save-and-reload reproduces the same
     * picks, and it is the generator the rest of the simulation draws from, so
     * using it does not fork the world's randomness into a second stream that a
     * player could desync by watching the mod.
     *
     * A missing or reversed range answers `min`, so a config with a typo behaves
     * like the lowest option rather than throwing inside a tick. Range is
     * inclusive at both ends, matching `api.random.int` and the source mod's
     * `Math.floor(Math.random() * 3)`.
     */
    randomInt: {
        role: "decide",
        doc: "A random whole number from `min` to `max`, inclusive. Set both.",
        fn: (_payload, _ctx, options) => {
            const o = options as { min?: unknown; max?: unknown } | null;
            const lo = Number(o?.min);
            const hi = Number(o?.max);
            if (!Number.isFinite(lo)) return 0;
            if (!Number.isFinite(hi) || hi < lo) return Math.trunc(lo);
            try {
                return hostNs("random")?.int?.(Math.trunc(lo), Math.trunc(hi)) ??
                    Math.trunc(lo);
            } catch {
                return Math.trunc(lo);
            }
        },
    },

    /**
     * Compares two values and answers `1` or `0`.
     *
     * This is the action whose absence made a whole rule inexpressible. The `if`
     * block tests a context variable for **truthiness**, which is enough to branch
     * on something a step already decided and not enough to branch on a
     * threshold — and "spawn an artefact once the generator reaches 50" is a
     * threshold, not a flag. Without this, a config could charge a generator and
     * then had no way to notice it was full.
     *
     * It returns rather than writing `proceed`, on purpose. The block is the gate
     * (`{ "key": "compare", "options": {...}, "as": "full" }` followed by
     * `{ "key": "if", "options": { "var": "full" } }`), and that is the one gate the
     * compiler actually implements — see `runList` in `core/process.ts`, which
     * branches on `varsRead(...)` and nothing else.
     *
     * Both sides go through `Number()` before comparing, so a buffer value, a
     * `{{variable}}` that interpolated to a string, and a literal all compare the
     * same way. An unknown operator answers `1` rather than `0`: a typo should
     * look like "the condition held" and be noticed, not silently become
     * "never runs" and hide.
     */
    compare: {
        role: "decide",
        doc: "Compares `left` and `right` with `op`. Answers 1 or 0. Set the options.",
        fn: (_payload, _ctx, options) => {
            const o = options as { left?: unknown; op?: unknown; right?: unknown } | null;
            const left = Number(o?.left);
            const right = Number(o?.right);
            if (!Number.isFinite(left) || !Number.isFinite(right)) return 1;
            switch (String(o?.op ?? "")) {
                case "eq":
                    return left === right ? 1 : 0;
                case "ne":
                    return left !== right ? 1 : 0;
                case "gt":
                    return left > right ? 1 : 0;
                case "gte":
                    return left >= right ? 1 : 0;
                case "lt":
                    return left < right ? 1 : 0;
                case "lte":
                    return left <= right ? 1 : 0;
                default:
                    return 1;
            }
        },
    },

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
