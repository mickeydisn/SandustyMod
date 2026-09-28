/**
 * `src/handler/` — the action system's public surface.
 *
 * Three layers, in dependency order:
 *
 *   - `../core/types.ts`     — the three axes (role, signature, call site) and
 *                              what an action declares. Imports nothing.
 *   - `../actions/`          — the actions themselves, one folder per role.
 *                              Imports only `types.ts`.
 *   - `core/`                — the machinery: the process compiler, the modifier
 *                              attach/detach, the scope table, the metadata
 *                              registry, and the dependency measurement.
 *
 * The old name was `hooks/`, which was wrong for most of what lived there: only
 * `core/apply.ts` talks to the engine's hook system. A modifier is a *call site*,
 * not a category of behaviour — see `../core/types.ts`.
 *
 * @module
 */

// The three axes, and the helpers an action file uses to declare itself.
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

// The catalogue, assembled from the role folders.
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

// The compiler.
export {
    actionRefsOf,
    type CompiledProcess,
    compileProcess,
    type ProcessFailure,
} from "./process.ts";

// Modifier attach / detach. The one place that uses the engine's hook api.
export {
    activeModifierIds,
    applyAllModifiers,
    applyModifier,
    detachAllModifiers,
    detachModifier,
} from "./apply.ts";

// What each call site hands an action, and what an action may therefore need.
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

// What an action depends on — measured, not declared.
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

// The typed registry the UI browses: slots, scopes, params, usage.
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

// The projectile options — a separate system, not a seventh role. A projectile
// holds one `ProjectileOption` and its *return* is the configuration; it is
// compiled by `compileProjectile`, not by `compileProcess` above.
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

// The published global needs these as *values*, not re-exports — the block below
// reads them, and a bare `export … from` does not bind a local name.
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

// The excavation options — the second feature that builds a value rather than
// performing one. Exported from here for the same reason as the projectile options:
// registration and the panel both need the compiler and the registry.
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

// ── The published global ─────────────────────────────────────────────────────
//
// The catalog and the panel read the catalogue from `globalThis.__mdHandlers`
// rather than importing it: the catalog is loaded before this module and cannot
// import it without a cycle. Publishing here is therefore a load-order contract,
// not a convenience — if this block moves or is removed, pickers silently show
// nothing rather than failing loudly.
try {
    (globalThis as Record<string, unknown>).__mdHandlers = {
        // The flat catalogue and the per-role grouping, which is what the new
        // role-based picker reads.
        ALL_ACTIONS,
        ACTIONS_BY_ROLE,
        ACTION_DOCS,
        ACTION_ROLES,
        ROLE_LABELS,
        ROLE_BLURBS,
        actionKeys,
        actionKeysOfRole,
        actionOf,
        // The three legacy views, kept so the catalog's existing lookups keep
        // working while the panel moves over to the role grouping.
        ANY_ACTIONS,
        PROCESSING_ACTIONS,
        MODIFIER_ACTIONS,
        // The list helpers `catalog.ts` calls through the global, and the three doc
        // maps it reads. Published under their **old** names on purpose: the catalog
        // is loaded before this module, so renaming these here would leave it
        // reading `undefined` and every picker would silently render empty. The
        // panel-side migration to the role grouping is a separate change; until it
        // lands, both spellings have to resolve.
        listAnyHandlerKeys: () => Object.keys(ANY_ACTIONS),
        listProcessorKeys: () => Object.keys(PROCESSING_ACTIONS),
        listHandlerKeys: () => Object.keys(MODIFIER_ACTIONS),
        ANY_HANDLER_DOCS: ACTION_DOCS,
        PROCESS_HANDLER_DOCS: ACTION_DOCS,
        CODE_HANDLER_DOCS: ACTION_DOCS,
        // The typed registry — drives every slot-scoped picker and the handler tab.
        HANDLER_META,
    };
} catch { /* the host object is frozen; the importers degrade to empty pickers */ }
