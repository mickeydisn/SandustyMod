/**
 * mdadmin — static configuration.
 *
 * Ids, storage key, log prefix and the keyboard toggle. Nothing here touches
 * the sandkit API.
 */

/** Mod id — also the `api.storage` namespace. */
export const MOD_ID = "mdadmin";

/** Shown in the panel footer. Keep in sync with `modinfo.json`. */
export const VERSION = "0.1.0";

/** Log prefix so every warning is attributable to this mod. */
export const LOG = `[${MOD_ID}]`;

/** `api.storage` key holding the remembered element removals. */
export const REMOVED_STORE_KEY = "removedElements";

/** `api.ui.inject` component id. */
export const PANEL_ID = `${MOD_ID}-panel`;

/** Panel toggle: Alt+L. */
export const TOGGLE_KEY = "KeyL";
export const TOGGLE_LABEL = "Alt+L";

/** Reported as the owner of an element id with no `owner:` namespace. */
export const BUILT_IN = "(built-in)";
