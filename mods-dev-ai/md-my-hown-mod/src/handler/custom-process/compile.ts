/**
 * Compiling one custom process into a callable.
 *
 * The counterpart to `../core/process.ts`'s `compileProcess`, and the layer that turns
 * "a named thing a definition references" into "a function the engine calls".
 *
 * ## Nesting, and why it needs a cycle guard
 *
 * A step may name **another process**. That is what makes composition worth having —
 * "sort the cell, then drain it" is two processes, and a third machine may want only
 * the first. But a process can therefore reference itself, directly or through a
 * chain, and the naive implementation recurses forever on a game tick with no way out.
 *
 * So expansion is **depth-limited and cycle-checked**, and both report rather than
 * hang. The depth limit is a backstop for what a cycle check cannot see: a chain of
 * forty distinct processes, which is legal and merely silly.
 *
 * ## The scope check
 *
 * A process declares its `scope`, checked against the slot it is used in. A
 * `processing` process referenced from a `signal` is refused, because its context is
 * seeded from a different call site's arguments and half its seeds would be
 * permanently absent. Refused here rather than left for the panel, so a hand-edited
 * config cannot produce a process that reads `commit` and finds nothing.
 *
 * ## Where the registry comes from
 *
 * A **parameter**, not an import. `../core/handler-registry.ts` reaches this module's
 * siblings through `core/process.ts` → `core/actions`, and importing the registry here
 * would close that loop. Taking it as an argument keeps the compiler testable with
 * three hand-made processes and no config at all.
 *
 * @module
 */
import { type CompiledProcess, compileProcess, type ProcessFailure } from "../core/process.ts";
import type { HandlerSlot } from "../core/handler-registry.ts";
import type { ProcessRegistry } from "./registry.ts";
import type { CustomProcessConfig, ProcessStep } from "./types.ts";

/** How deep a process may nest before the compiler stops expanding. */
export const MAX_NESTING = 8;

/** What went wrong while a process was compiled. */
export interface ProcessCompileFailure {
    /** The process id, or a step key inside one. */
    id: string;
    error: unknown;
}

/** What `compileCustomProcess` produced. */
export interface CompiledCustomProcess extends CompiledProcess {
    /** The process that was compiled. */
    processId: string;
    /** Ids of every process expanded into this one, the outermost first. */
    expanded: string[];
    /** True when a cycle or the depth limit cut the expansion short. */
    truncated: boolean;
}

/**
 * Why a reference could not be compiled, or `undefined` when it can.
 *
 * Separated from the compile step so the **panel** can ask the same question without
 * running anything, which is what the "cannot run here" message on a definition is
 * built from.
 */
export function processProblem(
    registry: ProcessRegistry,
    id: string,
    slot: HandlerSlot,
): string | undefined {
    const p = registry.get(id);
    if (!p) return `no such process: ${id}`;
    if (p.scope !== slot) return `built for ${p.scope}, used in ${slot}`;
    return undefined;
}

/**
 * Flatten one process into a single step list, expanding nested processes.
 *
 * `steps` comes back with each process's steps spliced in where it was named, so the
 * whole thing is then compiled by the *existing* `compileProcess` — one context for
 * the whole expansion, which is what makes a variable bound inside a nested process
 * readable by a step after it.
 *
 * `seen` is the cycle guard. It holds ids on the **current path**, not every id ever
 * expanded, so a diamond (A uses B, A uses C, both use D) is fine: D appears twice
 * but never inside itself.
 */
function expand(
    registry: ProcessRegistry,
    process: CustomProcessConfig,
    seen: readonly string[],
    depth: number,
    out: ProcessStep[],
    expanded: string[],
    onFailure?: (f: ProcessCompileFailure) => void,
): void {
    expanded.push(process.id);

    if (seen.includes(process.id)) {
        onFailure?.({ id: process.id, error: "cycle" });
        return;
    }
    if (depth > MAX_NESTING) {
        onFailure?.({ id: process.id, error: `nested deeper than ${MAX_NESTING}` });
        return;
    }
    const path = [...seen, process.id];

    for (const step of process.steps ?? []) {
        const nested = registry.get(step.key);
        if (nested) {
            // An `as` on a nested step is **not** honoured: a nested process runs many
            // actions and has no single return value, so binding the last one's result
            // would be a lie. Reported, not silently ignored.
            if (step.as) onFailure?.({ id: step.key, error: "a nested process binds nothing" });
            expand(registry, nested, path, depth + 1, out, expanded, onFailure);
            continue;
        }
        out.push(step);
    }
}

/**
 * Compile one process for one slot.
 *
 * Returns a callable even on total failure — a definition naming a broken process
 * still registers, with the process doing nothing, rather than the definition silently
 * not existing. A missing machine is easier to notice than a missing machine *and* a
 * console error about the machine.
 */
export function compileCustomProcess(
    registry: ProcessRegistry,
    id: string,
    slot: HandlerSlot,
    onFailure?: (f: ProcessCompileFailure) => void,
): CompiledCustomProcess {
    const empty = {
        fn: () => undefined,
        callSite: slot,
        skipped: [],
        unknownOptions: [],
        usesContext: false,
        processId: id,
        expanded: [] as string[],
        truncated: false,
    };

    const process = registry.get(id);
    if (!process) {
        onFailure?.({ id, error: "no such process" });
        return empty;
    }

    const problem = processProblem(registry, id, slot);
    if (problem) {
        onFailure?.({ id, error: problem });
        return { ...empty, expanded: [id], truncated: true };
    }

    const steps: ProcessStep[] = [];
    const expanded: string[] = [];
    let truncated = false;
    expand(
        registry,
        process,
        [],
        0,
        steps,
        expanded,
        (f) => {
            if (f.error === "cycle" || String(f.error).startsWith("nested deeper")) {
                truncated = true;
            }
            onFailure?.(f);
        },
    );

    // One compileProcess for the whole expansion, so a variable bound in a nested
    // process is readable by a step that follows it in the parent.
    const compiled = compileProcess(
        steps,
        slot,
        (f: ProcessFailure) => onFailure?.({ id: f.key, error: f.error }),
    );

    return { ...compiled, processId: id, expanded, truncated };
}
