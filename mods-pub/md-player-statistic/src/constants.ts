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

/**
 * `ItemType.Tool` from the sandkit enums.
 *
 * The enum is numeric (`Weapon = 1, Tool = 2, Consumable = 3, Mod = 4`) and the
 * engine branches on `itemType === SP.Tool`, so the string `"tool"` is never
 * equal to it and the item gets filed under the generic "items" category.
 */

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
export const TOOL_DESC = "<b>Player Statistic</b> — live KPI tracker of your actions.<br/>" +
    "Counts <i>structures placed / removed / moved</i>, <i>items used</i>, " +
    "<i>projectile hits</i>, <i>terrain dug</i>, <i>pickups</i> and " +
    "<i>resources collected</i>.<br/>" +
    "Home <b>KPI cards</b> are fully configurable.<br/>" +
    '<span style="opacity:0.85">Select the tool to open the overlay · lock it to keep it open.</span>';

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
    /** Points rendered on sparklines / charts. Steps by 10. */
    historyMax: {
        type: "number",
        default: 30,
        min: 10,
        max: 200,
        step: 10,
    },
    /**
     * Sample interval in minutes — one data point is recorded every N minutes.
     * A point holds the totals for *every* KPI, so this is the resolution of
     * the whole time series.
     */
    timeRange: {
        type: "number",
        default: 2,
        min: 1,
        max: 1440,
        step: 1,
    },
    /**
     * Max stored data points. Once full, the oldest point is dropped (FIFO),
     * so total storage stays bounded no matter how long the game runs.
     */
    maxCountSave: {
        type: "number",
        default: 120,
        min: 10,
        max: 2000,
        step: 10,
    },
} as const satisfies SettingsSchema;

/** KPI category ids used as card item kinds and list tabs. */
export type KpiCategory =
    | "structures_placed"
    | "structures_removed"
    | "structures_moved"
    | "items_used"
    | "projectiles_hit"
    | "projectile_fire_structure"
    | "terrain_destroyed"
    | "world_items_picked"
    | "resources_collected"
    | "keys_pressed"
    | "distance_walked"
    | "collisions";

export const KPI_CATEGORIES: { id: KpiCategory; label: string; color: string }[] = [
    { id: "structures_placed", label: "Structures placed", color: "#4ade80" },
    { id: "structures_removed", label: "Structures removed", color: "#f87171" },
    { id: "structures_moved", label: "Structures moved", color: "#60a5fa" },
    { id: "items_used", label: "Items used", color: "#fbbf24" },
    { id: "projectiles_hit", label: "Projectile hits", color: "#fb7185" },
    { id: "projectile_fire_structure", label: "Fire over structure", color: "#f59e0b" },
    { id: "terrain_destroyed", label: "Terrain dug", color: "#a78bfa" },
    { id: "world_items_picked", label: "World items picked", color: "#34d399" },
    { id: "resources_collected", label: "Resources collected", color: "#f472b6" },
    { id: "keys_pressed", label: "Keys pressed", color: "#22d3ee" },
    { id: "distance_walked", label: "Distance walked", color: "#38bdf8" },
    { id: "collisions", label: "Collisions", color: "#f97316" },
];

/**
 * Unit suffix shown in the panel. Absent = plain count.
 *
 * Empty by design: `distance_walked` has no unit on purpose — it is a scaled
 * figure (pixels ÷ cellSize ÷ 4), not a grid step, so labelling it "cells" would
 * lie. A category is added here only when its figure really is a unit.
 */
export const KPI_UNITS: Partial<Record<KpiCategory, string>> = {};
