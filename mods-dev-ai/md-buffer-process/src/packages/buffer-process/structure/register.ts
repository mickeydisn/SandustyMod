import type {
    ProcessDefinition,
    ProcessHandles,
    ProcessMapBuffer,
} from "../types.ts";
import { registerProcessStructure } from "./register/processRegister.ts";

export function registerProcessStructures(
    map: ProcessMapBuffer,
    defs: ProcessDefinition[],
): ProcessHandles {
    const structureIds: string[] = [];
    const processorIds: string[] = [];
    for (const def of defs) {
        const r = registerProcessStructure(def, map);
        structureIds.push(r.structureId);
        processorIds.push(r.processorId);
    }
    return { structureIds, processorIds };
}
