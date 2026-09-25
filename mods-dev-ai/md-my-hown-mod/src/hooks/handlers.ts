/**
 * Code-side handlers for hooks.intercept / hooks.modify.
 *
 * JSON config references these by `handlerKey`. Add new handlers here — they
 * become available to any ModifierConfig entry with matching handlerKey.
 *
 * Signatures:
 *   intercept: (args: unknown, ctx: unknown) => void
 *   modify:    (args: unknown) => unknown   // return value replaces/transforms
 */

export type InterceptHandler = (args: unknown, ctx: unknown) => void;
export type ModifyHandler = (args: unknown) => unknown;

export type CodeHandler =
    | { kind: "intercept"; fn: InterceptHandler }
    | { kind: "modify"; fn: ModifyHandler };

/**
 * Registry of live callbacks. Keys are stable strings used in JSON config.
 * Example config entry:
 *   { "id": "…", "hookId": "someHook", "kind": "intercept", "handlerKey": "logArgs" }
 */
export const CODE_HANDLERS: Record<string, CodeHandler> = {
    /** Generic logger for intercept hooks — useful while discovering hook names. */
    logArgs: {
        kind: "intercept",
        fn: (args, ctx) => {
            console.log("[md-my-hown-mod:modifier] intercept", args, ctx);
        },
    },

    /** Pass-through modify — returns args unchanged (probe that modify is wired). */
    identity: {
        kind: "modify",
        fn: (args) => args,
    },

    /**
     * Example: log building:placed-style payloads if hooked under a matching hookId.
     * Replace / extend with real game hook names as you discover them.
     */
    logBuildingPayload: {
        kind: "intercept",
        fn: (args) => {
            try {
                const a = args as Record<string, unknown> | null;
                console.log("[md-my-hown-mod:modifier] building-ish", a);
            } catch {
                console.log("[md-my-hown-mod:modifier] building-ish (raw)", args);
            }
        },
    },
};

/** Generic callbacks for signals / triggers / projectile getOptions / upgrade onUpgrade. */
export type AnyHandler = (...args: unknown[]) => unknown;

export const ANY_HANDLERS: Record<string, AnyHandler> = {
    signalLog: (payload, extra) => {
        console.log("[md-my-hown-mod:signal]", payload, extra);
    },
    triggerLog: (payload, extra) => {
        console.log("[md-my-hown-mod:trigger]", payload, extra);
    },
    /** Default projectile options factory. */
    defaultProjectileOptions: () => ({
        speed: 10,
        rotateWithVelocity: true,
    }),
    noop: () => undefined,
};

export function resolveAnyHandler(key: string | undefined): AnyHandler | undefined {
    if (!key) return undefined;
    if (key in ANY_HANDLERS) return ANY_HANDLERS[key];
    // Also allow CODE_HANDLERS intercept/modify fns for reuse
    const ch = CODE_HANDLERS[key];
    if (ch) return ch.fn as AnyHandler;
    return undefined;
}


export function resolveHandler(key: string | undefined): CodeHandler | undefined {
    if (!key) return undefined;
    return CODE_HANDLERS[key];
}

export function listHandlerKeys(): string[] {
    return Object.keys(CODE_HANDLERS);
}
