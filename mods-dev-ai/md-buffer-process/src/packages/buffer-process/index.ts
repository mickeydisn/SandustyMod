export type {
    ProcessAction,
    ProcessActif,
    ProcessDefinition,
    ProcessHandles,
    ProcessMapBuffer,
    ProcessOp,
} from "./types.ts";
export { PROCESS_CELL_MAX, PROCESS_SIZE } from "./types.ts";

export { registerProcessStructures } from "./structure/register.ts";
export { registerProcessStructure } from "./structure/register/processRegister.ts";
export { resolveActif, runAction, readCounter, actionPath } from "./ops.ts";
