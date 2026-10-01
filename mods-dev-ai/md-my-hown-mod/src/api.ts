/**
 * Host sandkit handle.
 *
 * ## Why this file no longer exports `api`
 *
 * It used to end with `export const api = sandkit.api as any` — a value
 * evaluated **once, when this module is first imported**. Every consumer then
 * held that one snapshot, so a host injected after import left them reading
 * `undefined` forever, and because every call was optional-chained it degraded
 * to an empty list or a `null` rather than an error. Pickers rendered empty and
 * nothing said why.
 *
 * That is the same failure already recorded in `handler/core/types.ts`, where a
 * `globalThis`-only read made every processing action silently no-op.
 *
 * So there is no `api` and no `root` here any more:
 *
 * - engine calls go through `packages/mysandkit.ts`, which resolves the host
 *   *per call* and wraps each one in try/catch;
 * - `getSandkit()` below is for the few places that genuinely need the raw host
 *   (React, enums), and it re-resolves on every call.
 *
 * The `declare const sandkit` is still the right way to see the host: the game
 * injects it into the mod scope, and it is not reliably on `globalThis`.
 */
import { g } from "./host.ts";

declare const sandkit: {
    api: Record<string, any>;
    react?: any;
    state?: any;
    mods?: any;
    enums?: any;
};

/**
 * Minimal structural type for the host React build.
 *
 * The game injects its own React copy; we cannot import the real types, but we
 * DO need the hooks to be generic so `useState<PanelState>(...)` type-checks.
 */
export interface HostReactType {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(initial: S | (() => S)) => [S, (v: S | ((prev: S) => S)) => void];
    useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void;
    useRef: <T>(initial: T) => { current: T };
    useCallback: <T>(fn: T, deps?: readonly unknown[]) => T;
    useMemo: <T>(fn: () => T, deps?: readonly unknown[]) => T;
}

/**
 * The host React build.
 *
 * The one deliberately eager read left in this file, and it is kept for a
 * concrete reason: `h` has to be a *bound* function, so React cannot be resolved
 * per call without turning 100+ `HostReact.useState(...)` call sites into
 * `hostReact().useState(...)`. React is present before any mod component mounts,
 * so the snapshot is taken long before it is needed.
 *
 * The engine api above was the opposite case — it is called during boot, during
 * discovery, and from the worker — which is exactly why it could not be
 * snapshotted.
 */
export const React = (sandkit as { react?: HostReactType }).react;
export const h = React?.createElement?.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export function toast(msg: string): void {
    safe(() => getSandkit()?.api?.ui?.toast?.(msg, {}));
}

/**
 * The host handle, resolved on **every** call.
 *
 * A delegate to `g()` in `host.ts`, which is the one place that knows the
 * resolution order: the injected `sandkit` first, then `globalThis`. This used to
 * be a third independent copy of that order — alongside `mysandkit.ts` and
 * `handler/core/types.ts` — and none of the three held the others to it, so a
 * change to one silently did not apply to the others.
 *
 * Only the places that genuinely need the raw host (React, enums) should call
 * this. Engine calls go through the wrapper in `host.ts`, which types them and
 * contains their failures.
 */
export function getSandkit(): typeof sandkit | any {
    return g() ?? null;
}
