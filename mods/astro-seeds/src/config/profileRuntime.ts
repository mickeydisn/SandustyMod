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
 *   - `moveSide` / `moveDown` — the Move.side / Move.down vote chances.
 *
 * Both threads import this file; it is pure data with no engine access.
 */

import { BufferControlsCategoryLabels } from "@sandmd/buffer-controls";

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
    moveSide: number;
    /** Move.down vote chance 0–100. */
    moveDown: number;
    /** Move.down vote chance 0–100. */
    moveUp: number;
    /** attraction Key */
    aSeed_Rate: number;
    aSeed_Weight: number;
    aGold_Rate: number;
    aGold_Weight: number;
    aCopper_Rate: number;
    aCopper_Weight: number;
}

/** The runtime knobs exposed in the buffer — also the allowed live/write keys. */
export type ProfileRuntimeKey = keyof ProfileRuntimeConfig;

/** Shape of the jsonBuffer record. */
export interface ProfileConfigRecord {
    P: Record<string, ProfileRuntimeConfig>;
}

/** The five profiles registered in `config/elementWorker/catalogue.ts`. */

/** The five profiles registered in `config/elementWorker/catalogue.ts`. */
export const PROFILE_IDS = [
    "InWater-ASeed",
    "InWater-AGold",
    "InWater-ACopper",
    "InGold-ASeed",
    "InGold-AGold",
    "InGold-ACopper",
    "InCopper-ASeed",
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

/** Buffer defaults — mirror the values hard-coded in the profiles. */
export function buildDefaultProfileRecord(): ProfileConfigRecord {
    const profiles: Record<string, ProfileRuntimeConfig> = {};
    for (const id of PROFILE_IDS) {
        profiles[id] = {
            enabled: true,
            tickSpeed: 50,
            growEnabled: false,
            crystalEnabled: false,
            moveSide: 15,
            moveDown: 20,
            moveUp: 20,
            aSeed_Rate: 0,
            aSeed_Weight: 0,
            aGold_Rate: 0,
            aGold_Weight: 0,
            aCopper_Rate: 0,
            aCopper_Weight: 0,
        };
    }
    // Per-profile overrides (copper is a faster, heavier faller).
    profiles["InCopper-ASeed"].moveSide = 25;
    profiles["InCopper-ASeed"].moveDown = 35;
    return { P: profiles };
}
