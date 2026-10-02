/**
 * Publishes the action tables on `globalThis.__mdHandlers`.
 *
 * The UI package cannot import from the handler package, so the panel reaches
 * these through the console instead. Only the fields something actually reads
 * are published: three key listers and the action docs, which all three DOCS
 * aliases point at. The rest of the tables were being published for nobody.
 */
import {
    ACTION_DOCS,
    ANY_ACTIONS,
    MODIFIER_ACTIONS,
    PROCESSING_ACTIONS,
} from "../actions/index.ts";

try {
    (globalThis as Record<string, unknown>).__mdHandlers = {
        listAnyHandlerKeys: () => Object.keys(ANY_ACTIONS),
        listProcessorKeys: () => Object.keys(PROCESSING_ACTIONS),
        listHandlerKeys: () => Object.keys(MODIFIER_ACTIONS),
        ANY_HANDLER_DOCS: ACTION_DOCS,
        PROCESS_HANDLER_DOCS: ACTION_DOCS,
        CODE_HANDLER_DOCS: ACTION_DOCS,
    };
} catch {
    // a locked-down host with no writable globalThis: the panel falls back
}
