/**
 * Signal handler shapes for `api.signals`.
 *
 * The host passes the structure (and often its payload) into these callbacks.
 * Keeping them typed beats `(...args: unknown[]) => unknown`, which made every
 * call site re-cast by hand.
 */

/** A structure receiver for signal delivery. */
export interface SignalTarget {
    /** Structure id, when the host reports one. */
    id?: string;
    [key: string]: unknown;
}

/**
 * Called when a signal reaches a registered target.
 *
 * Returning `false` stops propagation, matching the host's documented behaviour.
 */
export type SignalHandler = (structure: SignalTarget) => boolean | void;

/** Called when a player interacts with a registered signal interactable. */
export type SignalInteractableHandler = (
    structure: SignalTarget,
) => boolean | void;

/** Reads the outgoing signal value from a sender structure. */
export type SignalSenderReader = (structure: SignalTarget) => number | boolean | void;
