/** Mod id — also the storage / item / overlay namespace prefix. */
export const MOD_ID = "md-word-statistic";

/** Shown in the panel footer. */
export const VERSION = "0.7.4";

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

export const TOOL_NAME = "World Statistic";
export const TOOL_DESC =
    "<b>World Statistic</b> — live census of your dig site.<br/>" +
    "Count <i>elements</i>, <i>terrains</i> and <i>structures</i> on authorized cells only.<br/>" +
    "Home <b>resource cards</b>, history graphs, dig&nbsp;% vs baseline, auto-refresh.<br/>" +
    "<span style=\"opacity:0.85\">Select the tool to open the overlay · lock it to keep it open.</span>";

/** Label for built-in (non-mod) ids. */
export const BUILT_IN = "(built-in)";

/** How many cells to process per animation frame during a grid scan. */
export const SCAN_CHUNK = 4096;
