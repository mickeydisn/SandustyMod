/**
 * The dev console handle.
 *
 * `globalThis.__mdHandlers` exists so a modder can poke at the action table from the
 * browser console (`__mdHandlers.listProcessorKeys()`). It is a development
 * affordance, not API — nothing in `src/` reads it back.
 *
 * It used to be assembled inline at the bottom of `core/index.ts`, which meant the
 * barrel's export list and a side effect on `globalThis` were the same statement, and
 * deleting the handle meant reading the whole file. It is now one greppable file that
 * can be removed without touching the barrel.
 */

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
