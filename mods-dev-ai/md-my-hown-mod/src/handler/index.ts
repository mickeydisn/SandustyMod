export {
    ACTION_ROLES,
    type ActionDef,
    type ActionRole,
    type ActionSignature,
    BLOCK_KEY,
    CALL_SITE_LABELS,
    CALL_SITE_SIGNATURES,
    type CallSite,
    defineActions,
    defineModifiers,
    type HandlerActionFn,
    type HandlerActionRef,
    type HandlerProcessFn,
    isBlock,
    type ModifierAction,
    ROLE_BLURBS,
    ROLE_IO,
    ROLE_LABELS,
    type StoredAction,
} from "./engine/types.ts";

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
} from "./actions/index.ts";

// `main.ts` calls this at startup to hand the engine its buffer provider. It is part
// of the package's surface, so it goes through the barrel with everything else.
export { setBufferSource } from "./actions/custom/buffer.ts";

export {
    actionRefsOf,
    type CompiledProcess,
    compileProcess,
    type OptionKeysLookup,
    type ProcessFailure,
} from "./processing/process.ts";
export { optionKeysFor } from "./engine/handler-registry.ts";

export {
    activeModifierIds,
    applyAllModifiers,
    applyModifier,
    detachAllModifiers,
    detachModifier,
} from "./engine/apply.ts";

export {
    ACTION_SCOPE,
    ALL_CALL_SITES,
    asCallSite,
    asScopeNeed,
    CALL_SITE_SCOPE,
    canRunAt,
    canRunAtUnknown,
    describeNeeds,
    isActionKey,
    type MaybeCallSite,
    type MaybeScopeNeed,
    needsOf,
    needsOfUnknown,
    type ProcessScope,
    SCOPE_NEED_BLURBS,
    SCOPE_NEED_LABELS,
    SCOPE_NEEDS,
    type ScopeNeed,
    scopeSatisfies,
    slotsFor,
} from "./processing/scope.ts";

export {
    ACTION_DOMAIN_BLURBS,
    ACTION_DOMAIN_LABELS,
    ACTION_EFFECT_BLURBS,
    ACTION_EFFECT_LABELS,
    ACTION_FACTS,
    actionClassOf,
    type ActionDomain,
    type ActionEffect,
    type ActionFacts,
    actionFacts,
    type ActionKey,
    apiOf,
    domainOf,
    effectOf,
    type HandlerActionClass,
    isVacuousReturn,
    offRuleActions,
} from "./engine/action-facts.ts";

export { canBind, createContext } from "./engine/context.ts";

export { refsIn } from "./engine/refs.ts";

export { scopeSeedNames } from "./processing/scope-context.ts";

export {
    allHandlerTypes,
    ALL_SLOTS,
    BLOCK_META,
    buildHandlerOptions,
    type ContentKind,
    HANDLER_META,
    HANDLER_SCOPE_LABELS,
    HANDLER_SCOPE_LABELS as HANDLER_SCOPE_LABELS_UI,
    HANDLER_SLOT_LABELS,
    HANDLER_TYPE_LABELS,
    type HandlerMeta,
    handlerMeta,
    type HandlerParam,
    handlersForSlot,
    type HandlerSlot,
    handlersOfType,
    handlersOnlyAtSlot,
    type HandlerType,
    handlerTypesForKeys,
    type HandlerUsage,
    isHandlerKey,
    isOnlyAtSlot,
    scanExcavationOptionUsage,
    scanHandlerUsage,
    scanProjectileOptionUsage,
    TAB_TO_CALL_SITE,
    unreachableHandlers,
    usageIndex,
    validateHandlerParams,
} from "./engine/handler-registry.ts";

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
} from "./processing/projectile-option/index.ts";

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
} from "./processing/excavation-option/index.ts";

// The `globalThis.__mdHandlers` dev handle lives in its own file — see debug-handle.ts.
// It is imported for the side effect only; it exports nothing.
import "./engine/debug-handle.ts";
