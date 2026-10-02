
import {
    type CompiledProcess,
    compileProcess,
    type ProcessFailure,
} from "../process.ts";
import { type HandlerSlot, optionKeysFor } from "../../engine/handler-registry.ts";
import type { ProcessRegistry } from "./registry.ts";
import type { CustomProcessConfig, ProcessStep } from "./types.ts";

export const MAX_NESTING = 8;

export interface ProcessCompileFailure {
    
    id: string;
    error: unknown;
}

export interface CompiledCustomProcess extends CompiledProcess {
    
    processId: string;
    
    expanded: string[];
    
    truncated: boolean;
}

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
            
            
            
            if (step.as) onFailure?.({ id: step.key, error: "a nested process binds nothing" });
            expand(registry, nested, path, depth + 1, out, expanded, onFailure);
            continue;
        }
        out.push(step);
    }
}

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

    
    
    const compiled = compileProcess(
        steps,
        slot,
        (f: ProcessFailure) => onFailure?.({ id: f.key, error: f.error }),
        optionKeysFor,
    );

    return { ...compiled, processId: id, expanded, truncated };
}
