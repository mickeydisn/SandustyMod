/**
 * The **CustomProcess**: a named, reusable, author-built handler.
 *
 * A definition references one by id. Editing the process therefore changes every
 * definition that names it, which is the point (D5) — a duplicated `actions` array is
 * exactly the thing this object exists to delete.
 *
 * @module
 */
import type { HandlerSlot } from "../core/handler-registry.ts";
import type { HandlerActionRef } from "../core/types.ts";

/**
 * One step of a process.
 *
 * A `HandlerActionRef` plus the one field the process context needs: `as`, the
 * variable this step's return value is bound to. The type is shared rather than
 * redeclared so a step *is* an action ref — the compiler takes the same shape, and
 * there is no conversion step that could lose a field.
 */
export type ProcessStep = HandlerActionRef;

/** What a definition stores: an id, and nothing else. */
export interface ProcessRef {
    /** The process's id. */
    id: string;
}

/** The stored form of one process. */
export interface CustomProcessConfig {
    /** Unique id. The author's own process is named; a derived one carries `#process`. */
    id: string;
    /** The label shown in a picker. Falls back to the id. */
    name?: string;
    /** One line about what it does. */
    doc?: string;
    /**
     * Which call site this process is **for**.
     *
     * Not decoration: it decides the context the process is handed (`SCOPE_CONTEXT`),
     * and a definition in a different slot is refused at compile time rather than
     * left for the panel to notice.
     */
    scope: HandlerSlot;
    /** The steps, in order. */
    steps: ProcessStep[];
    /**
     * True when this process was converted from a definition's legacy `actions` array
     * by the migration in `store.ts`.
     *
     * It is a *marker*, not a lock: the author can rename and edit it like any other.
     * It exists so the panel can say where it came from, and so a derived process
     * belonging to an entry that has since been deleted can be cleaned up.
     */
    derived?: boolean;
    /** The definition this was derived from, when `derived`. */
    derivedFrom?: string;
}

/** Everything that can go wrong while one process is compiled. Surfaced, not swallowed. */
export interface ProcessCompileFailure {
    /** The process, or the step inside it, that failed. */
    id: string;
    error: unknown;
}
