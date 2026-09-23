/** Mod id — also the storage / item / overlay namespace prefix. */
export const MOD_ID = "md-word-statistic";

/** Shown in the panel footer. */
export const VERSION = "0.3.0";

/** Console prefix. */
export const LOG = "[md-word-statistic]";

/** Tool item id (hotbar). */
export const ITEM_ID = `${MOD_ID}:tool`;

/** Overlay id under the global zone. */
export const OVERLAY_ID = `${MOD_ID}:overlay`;

/** Sprite id for the tool icon. */
export const SPRITE_ID = `${MOD_ID}:icon`;

/** Path relative to the mod root (loaded via sprites.loadFromMod). */
export const SPRITE_PATH = "assets/statistic-icon.png";

/** i18n keys. */
export const NAME_KEY = `mods|${MOD_ID}|tool|name`;
export const DESC_KEY = `mods|${MOD_ID}|tool|desc`;

export const TOOL_NAME = "Word Statistic";
export const TOOL_DESC = "Open the world statistic overlay — counts of elements, structures and terrains on the grid.";

/** Label for built-in (non-mod) ids. */
export const BUILT_IN = "(built-in)";

/** How many cells to process per animation frame during a grid scan. */
export const SCAN_CHUNK = 4096;
