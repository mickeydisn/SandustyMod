
import { type HandlerSlot } from "../../engine/handler-registry.ts";
import { type ProcessFailure } from "../process.ts";
import { compileCustomProcess } from "./compile.ts";
import { currentProcessRegistry, type ProcessRegistry } from "./registry.ts";


export type ProcessSource =
    | { kind: "process"; id: string }
    | { kind: "none" };


export function processRefOf(entry: Record<string, unknown> | undefined): ProcessSource {
    if (!entry) return { kind: "none" };
    const id = entry.processId;
    if (typeof id === "string" && id) return { kind: "process", id };
    return { kind: "none" };
}


export interface CompiledEntry {
    
    fn: (structure?: unknown, context?: unknown) => void;
    
    source: ProcessSource;
    
    skipped: string[];
    
    unknownOptions: string[];
    
    usesContext: boolean;
    
    expanded: string[];
}


export function compileEntryProcess(
    entry: Record<string, unknown> | undefined,
    slot: HandlerSlot,
    registry?: ProcessRegistry,
    onFailure?: (f: ProcessFailure) => void,
): CompiledEntry {
    const source = processRefOf(entry);
    const reg = registry ?? currentProcessRegistry();

    if (source.kind === "none") {
        return {
            fn: () => undefined,
            source,
            skipped: [],
            unknownOptions: [],
            usesContext: false,
            expanded: [],
        };
    }

    const compiled = compileCustomProcess(
        reg,
        source.id,
        slot,
        (f) => onFailure?.({ key: f.id, error: f.error }),
    );
    return {
        fn: compiled.fn as () => void,
        source,
        skipped: compiled.skipped,
        unknownOptions: compiled.unknownOptions,
        usesContext: compiled.usesContext,
        expanded: compiled.expanded,
    };
}
