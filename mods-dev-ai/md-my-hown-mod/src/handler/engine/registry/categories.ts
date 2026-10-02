/**
 * Which config key holds each call site's entries.
 *
 * This is a vocabulary shared by the runtime and the compile-time layers, so
 * it lives in its own module rather than in either. `processing/` needs the
 * key set to know which categories the engine actually reads, and the registry
 * needs both directions of the mapping; neither should have to import the
 * other to get it.
 */
import type { HandlerSlot } from "./types.ts";

export const SLOT_LOCATION: Record<HandlerSlot, string> = {
    signal: "signals",
    trigger: "triggers",
    processing: "processing",
    upgrade: "upgrades",
    modifier: "modifiers",
    itemAction: "items",
};

/** Config key → call site. */
export const SLOTS_BY_CATEGORY: Record<string, HandlerSlot> = Object.fromEntries(
    Object.entries(SLOT_LOCATION).map(([slot, cfgKey]) => [cfgKey, slot as HandlerSlot]),
);

/** Just the keys, for membership tests. */
export const SLOT_CATEGORIES: ReadonlySet<string> = new Set(Object.keys(SLOTS_BY_CATEGORY));
