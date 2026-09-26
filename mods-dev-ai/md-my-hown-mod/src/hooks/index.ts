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
    ANY_HANDLER_DOCS,
    PROCESS_HANDLER_DOCS,
    CODE_HANDLER_DOCS,
} from "./handlers.ts";

export { listAnyHandlerKeys, listProcessorKeys };

// The typed registry: what a handler is, which slots may select it, its scope
// and its parameters. Published on the same global so the UI can browse it.
export {
    HANDLER_META,
    HANDLER_TYPE_LABELS,
    HANDLER_TYPE_BLURBS,
    HANDLER_SLOT_LABELS,
    HANDLER_SCOPE_LABELS,
    HANDLER_SCOPES,
    handlerMeta,
    handlersForSlot,
    handlersOfType,
    allHandlerTypes,
    isHandlerKey,
    validateHandlerParams,
    buildHandlerOptions,
    scanHandlerUsage,
    unreachableHandlers,
    usageIndex,
    type HandlerType,
    type HandlerSlot,
    type HandlerScope,
    type HandlerMeta,
    type HandlerParam,
    type HandlerUsage,
} from "./handler-registry.ts";

import { HANDLER_META } from "./handler-registry.ts";

try {
    (globalThis as any).__mdHandlers = {
        listHandlerKeys,
        listAnyHandlerKeys,
        listProcessorKeys,
        CODE_HANDLERS,
        ANY_HANDLERS,
        PROCESS_HANDLERS,
        // The UI builds `key — description` labels from these, so they must be
        // reachable from the catalog (which cannot import handlers.ts directly
        // without a cycle).
        ANY_HANDLER_DOCS,
        PROCESS_HANDLER_DOCS,
        // Modifier handlers live in CODE_HANDLERS, so their docs need publishing
        // too or they show up undocumented in the handler tab.
        CODE_HANDLER_DOCS,
        // Typed registry — drives every slot-scoped picker and the handler tab.
        HANDLER_META,
    };
} catch { /* */ }
