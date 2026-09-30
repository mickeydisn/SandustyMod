/**
 * md-player-statistic — static configuration.
 *
 * Event-driven player KPI tracker. Counts are accumulated in a live buffer
 * (no world scan) and persisted to mod storage. Users configure Home cards
 * that surface any tracked KPI.
 */
import type { SettingsSchema } from "./types.ts";

/** Mod id — doubles as the api.storage namespace and the id prefix we prune. */
export const MOD_ID = "md-player-statistic";

/** Shown in logs / panel footer. Keep in sync with modinfo.json. */
export const VERSION = "0.1.0";

/** Log prefix so every line is attributable to this mod. */
export const LOG = `[${MOD_ID}]`;

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

export const TOOL_NAME = "Player Statistic";
export const TOOL_DESC =
    "<b>Player Statistic</b> — live KPI tracker of your actions.<br/>" +
    "Counts <i>structures placed / removed / moved</i>, <i>items used</i>, " +
    "<i>terrain dug</i>, <i>pickups</i> and <i>resources collected</i>.<br/>" +
    "Home <b>KPI cards</b> are fully configurable.<br/>" +
    "<span style=\"opacity:0.85\">Select the tool to open the overlay · lock it to keep it open.</span>";

/** Every api.storage key this mod writes. */
export const STORAGE_KEYS = [
    "kpi_totals",
    "kpi_session",
    "kpi_history",
    "cards",
    "ui_pos",
    "ui_zoom",
    "ui_alpha",
    "ui_lock",
    "ui_mini",
] as const;

/** Mirror of configSchema in modinfo.json. */
export const SETTINGS = {
    enabled: { type: "boolean", default: true },
    persistSession: {
        type: "boolean",
        default: true,
    },
    historyMax: {
        type: "number",
        default: 20,
        min: 5,
        max: 50,
        step: 1,
    },
} as const satisfies SettingsSchema;

/** KPI category ids used as card item kinds and list tabs. */
export type KpiCategory =
    | "structures_placed"
    | "structures_removed"
    | "structures_moved"
    | "items_used"
    | "terrain_destroyed"
    | "world_items_picked"
    | "resources_collected";

export const KPI_CATEGORIES: { id: KpiCategory; label: string; color: string }[] = [
    { id: "structures_placed", label: "Structures placed", color: "#4ade80" },
    { id: "structures_removed", label: "Structures removed", color: "#f87171" },
    { id: "structures_moved", label: "Structures moved", color: "#60a5fa" },
    { id: "items_used", label: "Items used", color: "#fbbf24" },
    { id: "terrain_destroyed", label: "Terrain dug", color: "#a78bfa" },
    { id: "world_items_picked", label: "World items picked", color: "#34d399" },
    { id: "resources_collected", label: "Resources collected", color: "#f472b6" },
];
