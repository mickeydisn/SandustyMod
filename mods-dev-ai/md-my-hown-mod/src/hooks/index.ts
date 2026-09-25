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

try {
    (globalThis as any).__mdHandlers = { listHandlerKeys, CODE_HANDLERS, ANY_HANDLERS };
} catch { /* */ }
