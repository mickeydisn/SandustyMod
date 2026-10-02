export { resolveAction } from "../actions/index.ts";
import { resolveAction } from "../actions/index.ts";
import { createContext, type ProcessContext, varsRead, varsWrite } from "../engine/context.ts";
import { refsIn, resolveRefs } from "../engine/refs.ts";
import { seedsFor } from "./scope-context.ts";
import {
    type CallSite,
    type HandlerActionFn,
    type HandlerActionRef,
    type HandlerProcessFn,
    isBlock,
} from "../engine/types.ts";

export {
    BLOCK_KEY,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    type CallSite,
    flattenRefs,
    type HandlerActionRef,
    type HandlerProcessFn,
    isBlock,
} from "../engine/types.ts";

let optionKeysLookup: ((key: string) => ReadonlySet<string> | undefined) | undefined;

export function setOptionKeysLookup(
    fn: (key: string) => ReadonlySet<string> | undefined,
): void {
    optionKeysLookup = fn;
}

export function optionKeysFor(key: string | undefined): ReadonlySet<string> | undefined {
    return key ? optionKeysLookup?.(key) : undefined;
}

export interface ProcessFailure {
    key: string;
    error: unknown;
}

export const MAX_BLOCK_DEPTH = 8;

type CompiledStep =
    | {
        kind: "step";
        key: string;
        fn: HandlerActionFn;
        options: unknown;
        as?: string;
    }
    | {
        kind: "block";
        key: string;

        test: string;
        then: CompiledStep[];
        otherwise: CompiledStep[];
    };

export interface CompiledProcess {
    fn: HandlerProcessFn;
    callSite: CallSite;

    skipped: string[];

    unknownOptions: string[];

    usesContext: boolean;
}

export function compileProcess(
    refs: readonly HandlerActionRef[],
    callSite: CallSite,
    onFailure?: (f: ProcessFailure) => void,
): CompiledProcess {
    const skipped: string[] = [];
    const unknownOptions: string[] = [];
    let usesContext = false;

    const compileList = (list: readonly HandlerActionRef[], depth: number): CompiledStep[] => {
        const out: CompiledStep[] = [];
        for (const ref of list ?? []) {
            if (!ref || typeof ref.key !== "string" || !ref.key) continue;

            if (isBlock(ref)) {
                if (depth >= MAX_BLOCK_DEPTH) {
                    onFailure?.({
                        key: ref.key,
                        error: `blocks nested deeper than ${MAX_BLOCK_DEPTH}`,
                    });
                    continue;
                }
                const test = String((ref.options as { var?: unknown } | undefined)?.var ?? "");
                if (!test) {
                    onFailure?.({ key: ref.key, error: "an if block needs options.var" });
                    continue;
                }

                usesContext = true;
                out.push({
                    kind: "block",
                    key: ref.key,
                    test,
                    then: compileList(ref.then ?? [], depth + 1),
                    otherwise: compileList(ref.else ?? [], depth + 1),
                });
                continue;
            }

            if (ref.then || ref.else) {
                onFailure?.({ key: ref.key, error: "only an if block may have then/else" });
            }
            const fn = resolveAction(ref.key);
            if (typeof fn !== "function") {
                skipped.push(ref.key);
                continue;
            }
            const as = typeof ref.as === "string" && ref.as ? ref.as : undefined;

            const declared = optionKeysFor(ref.key);
            if (declared && ref.options) {
                for (const name of Object.keys(ref.options)) {
                    if (!declared.has(name)) {
                        unknownOptions.push(`${ref.key}.${name}`);
                    }
                }
            }

            if (as) usesContext = true;
            if (refsIn(ref.options).size > 0) usesContext = true;
            out.push({ kind: "step", key: ref.key, fn, options: ref.options, as });
        }
        return out;
    };

    const steps = compileList(refs, 0);

    const runList = (
        list: readonly CompiledStep[],
        payload: unknown,
        ctx: unknown,
        context: ProcessContext,
    ): void => {
        for (const step of list) {
            if (step.kind === "block") {
                runList(
                    varsRead(context, step.test) ? step.then : step.otherwise,
                    payload,
                    ctx,
                    context,
                );
                continue;
            }
            try {
                const { value, problems } = resolveRefs(
                    step.options as Record<string, unknown> | undefined,
                    context,
                    step.key,
                );
                for (const p of problems) onFailure?.({ key: step.key, error: p.name });
                const returned = step.fn(payload, ctx, value, context);
                if (step.as) {
                    const written = varsWrite(context, step.as, returned);
                    if (!written.ok) {
                        onFailure?.({ key: step.key, error: written.reason });
                    }
                }
            } catch (error) {
                onFailure?.({ key: step.key, error });
            }
        }
    };

    const fn: HandlerProcessFn = (...args: unknown[]) => {
        const [payload, ctx] = args;

        const context = createContext(seedsFor(callSite, args));
        runList(steps, payload, ctx, context);

        return context.result.value;
    };

    return { fn, callSite, skipped, unknownOptions, usesContext };
}

export function actionRefsOf(entry: Record<string, unknown> | undefined): HandlerActionRef[] {
    if (!entry) return [];
    if (!Array.isArray(entry.actions)) return [];
    return (entry.actions as Record<string, unknown>[])
        .filter((a) => typeof a?.key === "string" && a.key)
        .map((a) => ({
            key: String(a.key),
            options: (a.options as Record<string, unknown> | undefined) ?? undefined,

            ...(typeof a.as === "string" && a.as ? { as: a.as } : {}),
            ...(Array.isArray(a.then) ? { then: actionRefsOf({ actions: a.then }) } : {}),
            ...(Array.isArray(a.else) ? { else: actionRefsOf({ actions: a.else }) } : {}),
        }));
}
