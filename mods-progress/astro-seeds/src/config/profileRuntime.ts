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
/** Shared JSON capacity for the profile record. */
export const PROFILE_BUFFER_MAX_BYTES = 64 * 1024;

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
    P: Record<ProfileId, ProfileRuntimeConfig>;
}

/** Every profile registered in `config/elementWorker/catalogue.ts`. */
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

/** Initial picker item: the first profile's enabled switch. */
export const PROFILE_INITIAL_ITEM_ID = `P.${PROFILE_IDS[0]}.enabled`;

/**
 * The values used to create a new profile record and to repair an older
 * persisted record that does not contain a newly-added field.
 *
 * This is the only source of runtime defaults. Profile literals read these
 * values through `live()`; they must not carry their own fallback numbers.
 */
const COMMON_PROFILE_DEFAULTS: ProfileRuntimeConfig = {
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

export const PROFILE_DEFAULTS: Readonly<Record<ProfileId, ProfileRuntimeConfig>> = {
    "InWater-ASeed": { ...COMMON_PROFILE_DEFAULTS },
    "InWater-AGold": { ...COMMON_PROFILE_DEFAULTS },
    "InWater-ACopper": { ...COMMON_PROFILE_DEFAULTS },
    "InGold-ASeed": { ...COMMON_PROFILE_DEFAULTS, growEnabled: true, crystalEnabled: true },
    "InGold-AGold": { ...COMMON_PROFILE_DEFAULTS },
    "InGold-ACopper": { ...COMMON_PROFILE_DEFAULTS },
    "InCopper-ASeed": { ...COMMON_PROFILE_DEFAULTS, growEnabled: true, crystalEnabled: true },
};

const PROFILE_CATEGORY_COLORS: Readonly<Record<ProfileId, string>> = {
    "InWater-ASeed": "#0000FF",
    "InWater-AGold": "#22DD00",
    "InWater-ACopper": "#DD22FF",
    "InGold-ASeed": "#AA2299",
    "InGold-AGold": "#FFFF00",
    "InGold-ACopper": "#FF9900",
    "InCopper-ASeed": "#FF0055",
};

export const PROFILES_CONFIG: BufferControlsCategoryLabels[] = PROFILE_IDS.map((id) => ({
    id,
    color: PROFILE_CATEGORY_COLORS[id],
}));

/**
 * Custom buffer-controls art for the runtime keys — one entry per knob that
 * has its own drawing under `assets/buffers-02/` (falling back to
 * `assets/buffers/` where the new art hasn't landed yet):
 *   - bool knobs use a 2-frame `toggle-*.png` (frame 0 = off, frame 1 = on),
 *   - `*_Weight` knobs declare `toggleNum` with a 3-frame
 *     `tognum-*-weigth.png` (frames 0 / `>0` / `<0`, click flips the sign),
 *   - `*_Rate` knobs declare `toggleRate` with an N-frame
 *     `tognum-*-rate.png` (frame 0 is `<= 0`, the last frame is `>= 100`,
 *     the `N - 2` middle frames split `(0, 100)` evenly — 6 frames means
 *     steps of 25, 7 frames steps of 20 — click cycles the stops and wraps
 *     to 0). The sheet's frame count is declared explicitly in `frames`.
 *
 * Declaring the toggle in the sprite config is what creates the toggle
 * action at all — a number has no `toggleNum` / `toggleRate` button unless
 * an entry below declares it (so `*-rate.png` knobs get only `toggleRate`
 * and `*-weigth.png` knobs only `toggleNum`).
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
        filePath: "assets/buffers-02/toggle-moveEnabled.png",
    },
    {
        tag: "growEnabled",
        kind: "bool",
        action: "toggle",
        spriteId: "toggleGrow",
        filePath: "assets/buffers-02/toggle-growEnabled.png",
    },
    {
        tag: "crystalEnabled",
        kind: "bool",
        action: "toggle",
        spriteId: "toggleCrystal",
        filePath: "assets/buffers-02/toggle-crystalEnabled.png",
    },

    // rates — N frames: 0 is <=0, last is >=100, the rest split (0, 100).
    {
        tag: "random_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumRandomRate",
        filePath: "assets/buffers-02/tognum-random-rate.png",
        frames: 7,
    },
    {
        tag: "gravity_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumGravityRate",
        filePath: "assets/buffers-02/tognum-gravity-rate.png",
        frames: 7,
    },
    {
        tag: "aSeed_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumASeedRate",
        filePath: "assets/buffers-02/tognum-element-rate.png",
        frames: 7,
    },
    {
        tag: "aGold_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumAGoldRate",
        filePath: "assets/buffers-02/tognum-element-rate.png",
        frames: 7,
    },
    {
        tag: "aCopper_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumACopperRate",
        filePath: "assets/buffers-02/tognum-element-rate.png",
        frames: 7,
    },
    {
        tag: "aInertia_Rate",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumAInertiaRate",
        filePath: "assets/buffers-02/tognum-rand-rate.png",
        frames: 7,
    },
    {
        tag: "tickSpeed",
        kind: "number",
        action: "toggleRate",
        spriteId: "tognumTickSpeedRate",
        filePath: "assets/buffers-02/tognum_speed-rate.png",
        frames: 7,
    },

    // weights — 3 frames: 0 / >0 / <0 (`toggleNum` flips the sign).
    // Note: `buffers-02` spells these `*-weigth.png`.
    {
        tag: "random_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumRandomWeight",
        filePath: "assets/buffers-02/tognum-random-weigth.png",
    },
    {
        tag: "gravity_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumGravityWeight",
        filePath: "assets/buffers-02/tognum-gravity-weigth.png",
    },
    {
        tag: "aSeed_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumASeedWeight",
        filePath: "assets/buffers-02/tognum-element-astro-seed-weigth.png",
    },
    {
        tag: "aGold_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumAGoldWeight",
        filePath: "assets/buffers-02/tognum-element-astro-gold-weigth.png",
    },
    {
        tag: "aCopper_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumACopperWeight",
        filePath: "assets/buffers-02/tognum-element-astro-copper-weigth.png",
    },
    {
        tag: "aInertia_Weight",
        kind: "number",
        action: "toggleNum",
        spriteId: "tognumAInertiaWeight",
        filePath: "assets/buffers-02/tognum-rand-weigth.png",
    },
];

/** Build a fresh, fully-populated record for every registered profile. */
export function buildDefaultProfileRecord(): ProfileConfigRecord {
    const profiles = {} as Record<ProfileId, ProfileRuntimeConfig>;
    for (const id of PROFILE_IDS) {
        profiles[id] = { ...PROFILE_DEFAULTS[id] };
    }
    return { P: profiles };
}
