/**
 * The **one** place this mod looks for the host.
 *
 * ## Why this file exists
 *
 * Three resolvers had grown up independently:
 *
 * | was | used by | resolved |
 * |---|---|---|
 * | `packages/mysandkit.ts` → `g()` | boot, registration, panel | injected → `globalThis` |
 * | `handler/core/types.ts` → `hostApi()` | every processing action | injected → `globalThis` |
 * | `api.ts` → `getSandkit()` | react, enums, toast | injected → `globalThis` |
 *
 * All three claimed the same order and nothing held them to it, so a fix to one
 * was not a fix to the others — which is how the `globalThis`-only bug below
 * outlived the incident that caused it. They now share this file.
 *
 * ## The failure this is built around
 *
 * The host evaluates a mod as
 * `new Function("__sandkit", "const sandkit = __sandkit; return (async () => { … })()")`,
 * so `sandkit` is a **parameter in the mod's own scope**, not a property of the
 * global object. A probe of the running game confirmed it:
 *
 * ```
 * scoped=object scoped.api=object globalThis.sandkit=undefined
 * ```
 *
 * A `globalThis`-only read therefore yielded `undefined` here, and every action
 * no-opped — `hostNs("grid")?.mutate?.(…)` is an optional call on `undefined`,
 * so it returned falsy with nothing logged. Every tick, forever, quietly.
 *
 * ## Why one error and not a hundred
 *
 * `hostNs` returning `undefined` has two very different meanings, and the old
 * code could not tell them apart:
 *
 * - **no host at all** — catastrophic, and every single action is dead;
 * - **one namespace missing** — normal. Engine namespaces come and go between
 *   builds (`conveyors.registerType` is probed, not guaranteed), and a missing
 *   one is exactly what the probe is *for*.
 *
 * So only the first is logged, and only once. The second stays silent, because a
 * mod that shouts on every optional namespace would train you to ignore it.
 *
 * @module
 */

/**
 * An untrusted host namespace: indexable, unchecked, and deliberately so.
 *
 * The engine's own `.d.ts` are not in this mod's dependency graph, and the
 * generated index records *calls* rather than signatures — every parameter there
 * is `unknown`. So there is no honest type to write for `api.grid`, and inventing
 * one would be worse than none: it would let a renamed or misspelled method
 * type-check. `Record<string, any>` says "trust me, this is the host's namespace"
 * in one place instead of at every call site.
 *
 * // deno-lint-ignore no-explicit-any -- the cast IS the contract; see above.
 */
export type HostNamespace = Record<string, any>;

/** The part of the injected host this mod reads. Everything is optional by design. */
export interface HostSandkit {
    api?: HostNamespace;
    enums?: HostNamespace;
    react?: any;
    state?: any;
    mods?: any;
}

// The injected parameter. Referencing a bare undeclared name inside `typeof` is
// safe, which is why the checks below can ask about it at all in a scope — such
// as a worker test — where it was never bound.
declare const sandkit: HostSandkit | undefined;
/**
 * The host, resolved **once**, at module load.
 *
 * ## Why captured rather than re-resolved per call
 *
 * The host evaluates a mod as `new Function("__sandkit", …)`, so `sandkit` is a
 * *parameter in the mod's own scope* and is not on `globalThis` — a probe of the
 * running game showed `globalThis.sandkit === undefined`. Reading only the global
 * found nothing and every action in every role folder silently no-opped.
 *
 * `globalThis` is still consulted, and still second: it is what a worker scope and
 * a test harness provide. The order is the whole trick, so it is written once,
 * here, instead of in several modules that could disagree.
 *
 * Capturing at load is safe because the injected parameter is bound before this
 * module's body runs. The one thing it costs is that a test must install its fake
 * **before** importing the module under test — which is why the handler suites
 * import their actions dynamically.
 */
function resolveHost(): HostSandkit | undefined {
    try {
        if (typeof sandkit !== "undefined" && sandkit) return sandkit;
    } catch {
        // Not bound in this scope — fall through to the global fallback.
    }
    const g = globalThis as unknown as {
        sandkit?: HostSandkit;
        __sandkit?: HostSandkit;
    };
    return g.sandkit ?? g.__sandkit ?? undefined;
}

/**
 * The context's own reader for a cell value, or the ambient engine call.
 *
 * ## The policy, in one place
 *
 * Inside `process(structure, ctx)` the engine hands the structure a **batch-aware**
 * context: `ctx.getResolvedTypeAtCell` sees writes staged in the open
 * `grid.mutate` batch, while `api.elements.getResolvedTypeAtCell` does not. So the
 * context wins when it has the reader, and the api is the fallback — which also
 * makes the action work where no context is handed at all (an item handler, a hook).
 *
 * Written out by hand at each call site it had already drifted into three
 * spellings across three action folders, and they disagreed: the element family
 * checked `typeof … === "function"` while `sense` used `??`, which would adopt a
 * truthy non-function and fail later, further from the cause. One function fixes
 * the drift as well as the duplication.
 *
 * `ambient` is a **value**, not a namespace, so a caller whose fallback needs
 * shaping — `terrains.getDataAtCell` returns a data object where the context
 * returns hit points already extracted — passes a closure that does the conversion.
 * Both then arrive here as a plain reader.
 *
 * Lives here rather than in `packages/mysandkit.ts` for one concrete reason: an
 * action file importing the wrapper pulls `handler-registry` in behind it, and
 * that module initialises `process.ts` state at load — a cycle that throws
 * `Cannot access 'optionKeysLookup' before initialization`. This module has no
 * imports, so nothing can come back the other way. `mysandkit.ts` re-exports it,
 * so the wrapper is still where callers can reach it.
 */
export function preferContextReader(
    context: unknown,
    name: string,
    ambient: unknown = undefined,
): unknown {
    const fromContext = (context as Record<string, unknown> | null | undefined)?.[name];
    if (typeof fromContext === "function") return fromContext;
    return typeof ambient === "function" ? ambient : undefined;
}

/**
 * Whether a host with an api is reachable **right now**.
 *
 * A function rather than a value, because `api` is a live proxy that is truthy
 * even with no host — asking "is there a host?" by testing `api` would always say
 * yes. This is the only correct way to ask it.
 */
export function hostFound(): boolean {
    return !!resolveHost()?.api;
}

/** The host handle, or `undefined`. Used for `react` and `enums`. */
export const host: HostSandkit | undefined = resolveHost();

/**
 * The engine api — the one thing most of this mod reaches outside itself for.
 *
 * A caller writes `api?.grid?.mutate?.(…)`: a plain property read, no wrapper, no
 * call. That is the whole appeal.
 *
 * ## Why a Proxy rather than a captured value
 *
 * The obvious implementation is `export const api = host?.api`, evaluated once at
 * module load. It works in the game — the host is bound before this body runs —
 * but it makes `api` a fixed snapshot, and every test that installs a fake host
 * *after* importing the module under test then silently gets `undefined`. Six
 * action suites do exactly that, and the failure is invisible: an action reads a
 * missing namespace, returns falsy, and a test that means to prove it works goes
 * green on the wrong reason.
 *
 * So each property read is forwarded to whatever the host is *right now*. One
 * indirection, confined to this file, and the call sites stay plain reads.
 *
 * ## Absent is never a throw
 *
 * An action runs inside a processor tick, so throwing would abort the step and
 * could leave a half-applied write. That rule is named in the action suites
 * ("an absent api.elements is a warning and a false, never a throw"), so `?.` at
 * the call site is the intended shape, not laziness. The proxy honours it: a
 * missing namespace reads as `undefined`, exactly as it did before.
 *
 * The proxy is truthy even with no host, so `api` itself is never `undefined`.
 * That is fine — every caller asks it for a namespace, never for `api` — but it
 * is why no call site tests `if (!api)`.
 */
// deno-lint-ignore no-explicit-any -- the trap is untyped by nature; see HostNamespace.
export const api: HostNamespace = new Proxy({} as Record<string, any>, {
    get: (_target, key: string | symbol) => {
        const live = resolveHost()?.api as Record<string, any> | undefined;
        return typeof key === "string" ? live?.[key] : undefined;
    },
    has: (_target, key: string | symbol) => {
        const live = resolveHost()?.api;
        return typeof key === "string" && !!live && key in live;
    },
});

/**
 * Whether a namespace exists on the host, without reporting anything.
 *
 * Reads the captured `api`, so probing from the boot audit cannot itself be the
 * thing that logs.
 */
export function hasNamespace(...path: string[]): boolean {
    let node: unknown = api;
    for (const key of path) {
        if (node === null || (typeof node !== "object" && typeof node !== "function")) {
            return false;
        }
        node = (node as Record<string, unknown>)[key];
    }
    return node !== null && node !== undefined;
}
