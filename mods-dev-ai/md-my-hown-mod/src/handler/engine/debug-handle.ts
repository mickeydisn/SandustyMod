

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
} catch {}
