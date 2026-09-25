export {
    CODE_HANDLERS,
    resolveHandler,
    listHandlerKeys,
    type CodeHandler,
    type InterceptHandler,
    type ModifyHandler,
} from "./handlers.ts";

export {
    applyModifier,
    detachModifier,
    applyAllModifiers,
    detachAllModifiers,
    activeModifierIds,
} from "./apply.ts";

export { ANY_HANDLERS, resolveAnyHandler, type AnyHandler } from "./handlers.ts";
export {
    PROCESS_HANDLERS,
    type ProcessHandler,
} from "./handlers.ts";
import {
    listHandlerKeys,
    listAnyHandlerKeys,
    listProcessorKeys,
    CODE_HANDLERS,
    ANY_HANDLERS,
    PROCESS_HANDLERS,
} from "./handlers.ts";

export { listAnyHandlerKeys, listProcessorKeys };

try {
    (globalThis as any).__mdHandlers = {
        listHandlerKeys,
        listAnyHandlerKeys,
        listProcessorKeys,
        CODE_HANDLERS,
        ANY_HANDLERS,
        PROCESS_HANDLERS,
    };
} catch { /* */ }
