/**
 * Per-profile runtime configuration, carried by a JsonBuffer shared between
 * the main thread (edited live through @sandmd/buffer-controls structures)
 * and the worker (whose profiles read their values from the buffer by path).
 *
 * One entry per profile id in `config/elementWorker/catalogue.ts`:
 *   - `enabled`  — run the profile at all (false = vanilla physics),
 *   - `tickSpeed` — the profile's per-tick chance 0..100,
 *   - `growEnabled` — run the grow phase,
 *   - `crystalEnabled` — run the crystallization phase,
 *   - `random_Rate` / `gravity_Rate` / `a*_Rate` — the Move vote chances,
 *   - `*_Weight` — the matching Move weights (negative = repel).
 *
 * Both threads import this file; it is pure data with no engine access.
 */

import type { BufferControlsCategoryLabels, BufferControlsSprite } from "@sandmd/buffer-controls";

/** Shared jsonBuffer id (main writes, worker observes). */
export const PROFILE_BUFFER_ID = "astro-seeds:profileConfig";

/** Runtime knobs exposed in the buffer for one profile. */
export interface ProfileRuntimeConfig {
    /** Run this profile at all. */
    enabled: boolean;
    /** Per-tick chance (0–100) the pipeline actually does something. */
    tickSpeed: number;
    /** Run the grow phase. */
    growEnabled: boolean;
    /** Run the crystallization phase. */
    crystalEnabled: boolean;
    /** Move.side vote chance 0–100. */
    random_Rate: number;
    random_Weight: number;
    /** Move.down vote chance 0–100. */
    gravity_Rate: number;
    gravity_Weight: number;
    /** attraction Key */
    aSeed_Rate: number;
    aSeed_Weight: number;
    aGold_Rate: number;
    aGold_Weight: number;
    aCopper_Rate: number;
    aCopper_Weight: number;
    aInertia_Rate: number;
    aInertia_Weight: number;
}

/** The runtime knobs exposed in the buffer — also the allowed live/write keys. */
export type ProfileRuntimeKey = keyof ProfileRuntimeConfig;

/** Shape of the jsonBuffer record. */
export interface ProfileConfigRecord {
    P: Record<string, ProfileRuntimeConfig>;
}

/** The five profiles registered in `config/elementWorker/catalogue.ts`. */
export const PROFILE_IDS = [
    "InWater-ASeed",
    "InWater-AGold",
    "InWater-ACopper",
    // "InGold-ASeed",
    // "InGold-AGold",
    // "InGold-ACopper",
    // "InCopper-ASeed",
] as const;

export type ProfileId = (typeof PROFILE_IDS)[number];

export const PROFILES_CONFIG: BufferControlsCategoryLabels[] = [
    { id: "InWater-ASeed", color: "#0000FF" },
    { id: "InWater-AGold", color: "#22DD00" },
    { id: "InWater-ACopper", color: "#DD22FF" },
    { id: "InGold-ASeed", color: "#AA2299" },
    { id: "InGold-AGold", color: "#FFFF00" },
    { id: "InGold-ACopper", color: "#FF9900" },
    { id: "InCopper-ASeed", color: "#FF0055" },
] as const;

/**
 * Custom buffer-controls art for the runtime keys — one entry per knob that
 * has its own drawing under `assets/buffers/`:
 *   - bool knobs use a 2-frame `toggle-*.png` (frame 0 = off, frame 1 = on),
 *   - number knobs use a 3-frame `tognum-*.png` (0 / `>0` / `<0`).
 *
 * `tag` is the catalogue tag of the bound path's last segment, so a single
 * entry covers that knob on every profile (`P.<profileId>.<key>`). Any knob
 * without an entry falls back to the generic `assets/types/*` art declared in
 * `main/build.ts`.
 *
 * `spriteId` is the logical id the asset is loaded and referenced under; it
 * must be unique across the mod's sprite list.
 */
export type ProfileSprite = BufferControlsSprite & {
    /** Buffer key this art belongs to (compile-checked against the record). */
    tag: ProfileRuntimeKey;
};

export const PROFILE_SPRITES: readonly ProfileSprite[] = [
    // bool — 2 frames. `enabled` kept its historical asset name (`moveEnabled`).
    {
        tag: "enabled",
        kind: "bool",
        action: "toggle",
        spriteId: "toggleMove",
        filePath: "assets/buffers/toggle-moveEnabled.png",
    },
    {
        tag: "growEnabled",
        kind: "bool",
        action: "toggle",
        spriteId: "toggleGrow",
        filePath: "assets/buffers/toggle-growEnabled.png",
    },
    {
        tag: "crystalEnabled",
        kind: "bool",
        action: "toggle",
        spriteId: "toggleCrystal",
        filePath: "assets/buffers/toggle-crystalEnabled.png",
    },

    // number — 3 frames: 0 / >0 / <0.
    {
        tag: "random_Rate",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumRandom",
        filePath: "assets/buffers/tognum-random-rate.png",
    },
    {
        tag: "gravity_Rate",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumGravity",
        filePath: "assets/buffers/tognum-gravity-rate.png",
    },
    {
        tag: "aSeed_Rate",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumASeed",
        filePath: "assets/buffers/tognum-astro-seed-rate.png",
    },
    {
        tag: "aGold_Rate",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumAGold",
        filePath: "assets/buffers/tognum-astro-gold-rate.png",
    },
    {
        tag: "aCopper_Rate",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumACopper",
        filePath: "assets/buffers/tognum-astro-copper-rate.png",
    },
];

/** Buffer defaults — mirror the values hard-coded in the profiles. */
export function buildDefaultProfileRecord(): ProfileConfigRecord {
    const profiles: Record<string, ProfileRuntimeConfig> = {};
    for (const id of PROFILE_IDS) {
        profiles[id] = {
            enabled: true,
            tickSpeed: 50,
            growEnabled: false,
            crystalEnabled: false,
            random_Rate: 20,
            random_Weight: 10,
            gravity_Rate: 20,
            gravity_Weight: 10,
            aSeed_Rate: 20,
            aSeed_Weight: 0,
            aGold_Rate: 20,
            aGold_Weight: 20,
            aCopper_Rate: 20,
            aCopper_Weight: 0,
            aInertia_Rate: 100,
            aInertia_Weight: 0,
        };
    }
    return { P: profiles };
}
