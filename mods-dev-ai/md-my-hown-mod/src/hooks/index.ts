export { CODE_HANDLERS, type CodeHandler, listHandlerKeys, resolveHandler } from "./handlers.ts";

export {
    activeModifierIds,
    applyAllModifiers,
    applyModifier,
    detachAllModifiers,
    detachModifier,
} from "./apply.ts";

export { ANY_HANDLERS, resolveAnyHandler } from "./handlers.ts";
export { PROCESS_HANDLERS } from "./handlers.ts";

// The other axis: what an object links to, compiled from a list of actions.
export {
    actionRefsOf,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    type CompiledProcess,
    compileProcess,
    type HandlerActionRef,
    type ProcessFailure,
    resolveAction,
} from "./process.ts";

// The projectile options — a separate system, not a seventh call site. A projectile
// holds one `ProjectileOption` and its return is the configuration; it is compiled
// by `compileProjectile`, not by `compileProcess` above.
export {
    type CompiledProjectileOption,
    compileProjectile,
    PROJECTILE_OPTION_DOCS,
    PROJECTILE_OPTION_STORE_KEY,
    PROJECTILE_OPTIONS,
    type ProjectileGetOptions,
    type ProjectileOptionFailure,
    type ProjectileOptionFn,
    projectileOptionKeys,
    projectileOptionOf,
    projectileOptionParams,
    type ProjectileOptionRef,
    resolveProjectileOption,
} from "./projectile-option/index.ts";

// What an action depends on: `api` (the rule) or one of the three ways an action
// falls short of it. See action-class.ts for why it is a ladder.
export {
    ACTION_CLASS_BLURBS,
    ACTION_CLASS_LABELS,
    ACTION_CLASSES,
    actionClassOf,
    type HandlerActionClass,
    offRuleActions,
} from "./action-class.ts";
import {
    ANY_HANDLER_DOCS,
    ANY_HANDLERS,
    CODE_HANDLER_DOCS,
    CODE_HANDLERS,
    listAnyHandlerKeys,
    listHandlerKeys,
    listProcessorKeys,
    PROCESS_HANDLER_DOCS,
    PROCESS_HANDLERS,
} from "./handlers.ts";

export { listAnyHandlerKeys, listProcessorKeys };

// The typed registry: what a handler is, which slots may select it, its scope
// and its parameters. Published on the same global so the UI can browse it.
export {
    allHandlerTypes,
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SCOPES,
    HANDLER_SLOT_LABELS,
    HANDLER_TYPE_BLURBS,
    HANDLER_TYPE_LABELS,
    type HandlerMeta,
    handlerMeta,
    type HandlerParam,
    type HandlerScope,
    handlersForSlot,
    type HandlerSlot,
    handlersOfType,
    type HandlerType,
    type HandlerUsage,
    isHandlerKey,
    scanHandlerUsage,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
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
