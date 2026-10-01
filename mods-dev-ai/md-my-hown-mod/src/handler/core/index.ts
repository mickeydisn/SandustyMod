


export {
    ACTION_ROLES,
    type ActionDef,
    type ActionRole,
    type ActionSignature,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    CALL_SITE_USES_RETURN,
    type CallSite,
    defineActions,
    defineModifiers,
    type HandlerActionFn,
    type HandlerActionRef,
    type HandlerProcessFn,
    type ModifierAction,
    ROLE_BLURBS,
    ROLE_IO,
    ROLE_LABELS,
    type StoredAction,
} from "./types.ts";


export {
    ACTION_DOCS,
    actionKeys,
    actionKeysOfRole,
    actionOf,
    ACTIONS_BY_ROLE,
    ALL_ACTIONS,
    ANY_ACTIONS,
    FOLDERS,
    MODIFIER_ACTIONS,
    PROCESSING_ACTIONS,
    resolveAction,
    resolveModifier,
} from "../actions/index.ts";


export {
    actionRefsOf,
    type CompiledProcess,
    compileProcess,
    type ProcessFailure,
} from "./process.ts";


export {
    activeModifierIds,
    applyAllModifiers,
    applyModifier,
    detachAllModifiers,
    detachModifier,
} from "./apply.ts";


export {
    ACTION_SCOPE,
    CALL_SITE_SCOPE,
    canRunAt,
    describeNeeds,
    needsOf,
    type ProcessScope,
    SCOPE_NEED_BLURBS,
    SCOPE_NEED_LABELS,
    SCOPE_NEEDS,
    type ScopeNeed,
    scopeSatisfies,
    slotsFor,
} from "./scope.ts";


export {
    ACTION_CLASS_BLURBS,
    ACTION_CLASS_LABELS,
    ACTION_CLASSES,
    actionClassOf,
    type ActionDeps,
    type HandlerActionClass,
    measureActionDeps,
    offRuleActions,
} from "./action-class.ts";


export {
    allHandlerTypes,
    buildHandlerOptions,
    HANDLER_META,
    HANDLER_SCOPE_LABELS as HANDLER_SCOPE_LABELS_UI,
    type HandlerMeta,
    handlerMeta,
    type HandlerParam,
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
} from "../projectile-option/index.ts";



import {
    ACTION_DOCS,
    actionKeys,
    actionKeysOfRole,
    actionOf,
    ACTIONS_BY_ROLE,
    ALL_ACTIONS,
    ANY_ACTIONS,
    MODIFIER_ACTIONS,
    PROCESSING_ACTIONS,
} from "../actions/index.ts";
import { ACTION_ROLES, ROLE_BLURBS, ROLE_LABELS } from "./types.ts";
import { HANDLER_META } from "./handler-registry.ts";




export {
    type CompiledExcavationOption,
    compileExcavationProfile,
    EXCAVATION_FLAGS,
    EXCAVATION_OPTION_DOCS,
    EXCAVATION_OPTION_STORE_KEY,
    EXCAVATION_OPTIONS,
    type ExcavationFlag,
    type ExcavationOptionFailure,
    type ExcavationOptionFn,
    excavationOptionKeys,
    excavationOptionOf,
    excavationOptionParams,
    type ExcavationOptionPatch,
    type ExcavationOptionRef,
    type ExcavationOptionValue,
    resolveExcavationOption,
} from "../excavation-option/index.ts";








try {
    (globalThis as Record<string, unknown>).__mdHandlers = {
        
        
        ALL_ACTIONS,
        ACTIONS_BY_ROLE,
        ACTION_DOCS,
        ACTION_ROLES,
        ROLE_LABELS,
        ROLE_BLURBS,
        actionKeys,
        actionKeysOfRole,
        actionOf,
        
        
        ANY_ACTIONS,
        PROCESSING_ACTIONS,
        MODIFIER_ACTIONS,
        
        
        
        
        
        
        listAnyHandlerKeys: () => Object.keys(ANY_ACTIONS),
        listProcessorKeys: () => Object.keys(PROCESSING_ACTIONS),
        listHandlerKeys: () => Object.keys(MODIFIER_ACTIONS),
        ANY_HANDLER_DOCS: ACTION_DOCS,
        PROCESS_HANDLER_DOCS: ACTION_DOCS,
        CODE_HANDLER_DOCS: ACTION_DOCS,
        
        HANDLER_META,
    };
} catch {  }
