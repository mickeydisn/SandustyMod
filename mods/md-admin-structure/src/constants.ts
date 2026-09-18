/**
 * md-admin-structure — static configuration.
 *
 * Ids, log prefix and the keyboard toggle. Nothing here touches the sandkit API.
 */

/** Mod id. */
export const MOD_ID = "md-admin-structure";

/** Shown in the panel footer. Keep in sync with `modinfo.json`. */
export const VERSION = "0.1.0";

/** Log prefix so every warning is attributable to this mod. */
export const LOG = `[${MOD_ID}]`;

/** `api.ui.inject` component id. */
export const PANEL_ID = `${MOD_ID}-panel`;

/** Panel toggle: Alt+O. */
export const TOGGLE_KEY = "KeyO";
export const TOGGLE_LABEL = "Alt+O";

/** Reported as the owner of a structure id with no `owner:` namespace. */
export const BUILT_IN = "(built-in)";

/** Row glyphs: `hideFromBuildMenu` on / off. */
export const ICON_HIDDEN = "\u{1F573}";
export const ICON_SHOWN = "▣";
