/**
 * Per-profile runtime configuration — the single source of truth for the astro
 * profiles' live buffer, shared between the main thread (edited live through
 * `@sandmd/buffer-controls` structures) and the worker (whose profiles read
 * their values from the buffer by path).
 *
 * A knob is declared once in `PROFILE_KNOBS`, a profile once in `PROFILES`, and
 * `PROFILE_FIELDS` crosses the two into the per-path field list that
 * `registerBufferControls` consumes. The package derives the JsonBuffer record,
 * the sprite list, the live value validation and every catalogue item's tag /
 * category from that list, so nothing here is declared twice:
 *
 *     PROFILE_KNOBS × PROFILES  →  PROFILE_FIELDS  →  record + sprites + tabs
 *
 * Adding a knob = one `PROFILE_KNOBS` line (the record type, the validation and
 * the picker follow). Adding a profile = one `PROFILES` line.
 * Both threads import this file; it is pure data with no engine access.
 */

import {
    buildFieldsRecord,
    type BufferControlsCategoryLabels,
    type BufferControlsField,
    type BufferControlsFieldSprite,
} from "@sandmd/buffer-controls";

/** Shared jsonBuffer id (main writes, worker observes). */
export const PROFILE_BUFFER_ID = "astro-seeds:profileConfig";
/** Shared JSON capacity for the profile record. */
export const PROFILE_BUFFER_MAX_BYTES = 64 * 1024;

/**
 * One runtime knob, shared by every profile:
 *   - `key`     — the record field, the sprite tag and the picker filter tag,
 *   - `kind`    — the record's value type, which is also the live validation,
 *   - `default` — used unless a profile overrides it,
 *   - `sprite`  — this knob's art. A bool uses a 2-frame `toggle-*.png`
 *     (frame 0 = off, frame 1 = on); a number may declare `toggleNum`
 *     (`*-weigth.png`, click flips the sign) or `toggleRate` (`*-rate.png`,
 *     `frames` N: frame 0 is `<= 0`, the last is `>= 100`, the `N - 2` middle
 *     frames split `(0, 100)` evenly — click cycles the stops and wraps to 0).
 *     Declaring one of those actions is what creates the toggle button at all.
 *     A knob with no `sprite` falls back to the generic per-kind art.
 */
interface ProfileKnob {
    key: string;
    kind: "bool" | "number";
    default: boolean | number;
    sprite?: BufferControlsFieldSprite;
}

/** Every runtime knob, once — grouped bool / rate / weight. */
export const PROFILE_KNOBS = [
    // --- bools (2 frames) ------------------------------------------------
    // `enabled` kept its historical asset name (`moveEnabled`).
    {
        key: "enabled",
        kind: "bool",
        default: true,
        sprite: {
            spriteId: "toggleMove",
            filePath: "assets/buffers-02/toggle-moveEnabled.png",
            action: "toggle",
        },
    },
    {
        key: "growEnabled",
        kind: "bool",
        default: false,
        sprite: {
            spriteId: "toggleGrow",
            filePath: "assets/buffers-02/toggle-growEnabled.png",
            action: "toggle",
        },
    },
    {
        key: "crystalEnabled",
        kind: "bool",
        default: false,
        sprite: {
            spriteId: "toggleCrystal",
            filePath: "assets/buffers-02/toggle-crystalEnabled.png",
            action: "toggle",
        },
    },

    // --- rates (7 frames → 0 / 20 / 40 / 60 / 80 / 100) ------------------
    {
        key: "tickSpeed",
        kind: "number",
        default: 50,
        sprite: {
            spriteId: "tognumTickSpeedRate",
            filePath: "assets/buffers-02/tognum_speed-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "random_Rate",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumRandomRate",
            filePath: "assets/buffers-02/tognum-random-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "gravity_Rate",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumGravityRate",
            filePath: "assets/buffers-02/tognum-gravity-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "aSeed_Rate",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumASeedRate",
            filePath: "assets/buffers-02/tognum-element-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "aGold_Rate",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumAGoldRate",
            filePath: "assets/buffers-02/tognum-element-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "aCopper_Rate",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumACopperRate",
            filePath: "assets/buffers-02/tognum-element-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },
    {
        key: "aInertia_Rate",
        kind: "number",
        default: 100,
        sprite: {
            spriteId: "tognumAInertiaRate",
            filePath: "assets/buffers-02/tognum-rand-rate.png",
            action: "toggleRate",
            frames: 7,
        },
    },

    // --- move weights (3 frames: 0 / >0 / <0, click flips the sign) ------
    // `buffers-02` spells the asset `*-weigth.png`.
    {
        key: "random_Weight",
        kind: "number",
        default: 10,
        sprite: {
            spriteId: "tognumRandomWeight",
            filePath: "assets/buffers-02/tognum-random-weigth.png",
            action: "toggleNum",
        },
    },
    {
        key: "gravity_Weight",
        kind: "number",
        default: 10,
        sprite: {
            spriteId: "tognumGravityWeight",
            filePath: "assets/buffers-02/tognum-gravity-weigth.png",
            action: "toggleNum",
        },
    },
    {
        key: "aSeed_Weight",
        kind: "number",
        default: 0,
        sprite: {
            spriteId: "tognumASeedWeight",
            filePath: "assets/buffers-02/tognum-element-astro-seed-weigth.png",
            action: "toggleNum",
        },
    },
    {
        key: "aGold_Weight",
        kind: "number",
        default: 20,
        sprite: {
            spriteId: "tognumAGoldWeight",
            filePath: "assets/buffers-02/tognum-element-astro-gold-weigth.png",
            action: "toggleNum",
        },
    },
    {
        key: "aCopper_Weight",
        kind: "number",
        default: 0,
        sprite: {
            spriteId: "tognumACopperWeight",
            filePath: "assets/buffers-02/tognum-element-astro-copper-weigth.png",
            action: "toggleNum",
        },
    },
    {
        key: "aInertia_Weight",
        kind: "number",
        default: 0,
        sprite: {
            spriteId: "tognumAInertiaWeight",
            filePath: "assets/buffers-02/tognum-rand-weigth.png",
            action: "toggleNum",
        },
    },
] as const satisfies readonly ProfileKnob[];

/** Knob entries, derived from `PROFILE_KNOBS`. */
type ProfileKnobEntry = (typeof PROFILE_KNOBS)[number];

/** The runtime knob keys — also the allowed `live()` / write keys. */
export type ProfileRuntimeKey = ProfileKnobEntry["key"];

/**
 * The record shape, derived from `PROFILE_KNOBS`: a `bool` knob is a boolean,
 * every other knob a number.
 */
export type ProfileRuntimeConfig = {
    [K in ProfileKnobEntry as K["key"]]: K["kind"] extends "bool" ? boolean : number;
};

/** Knob key → kind, for the worker's live-value validation and display. */
export const PROFILE_KNOB_KIND: Readonly<Record<ProfileRuntimeKey, "bool" | "number">> =
    Object.fromEntries(
        PROFILE_KNOBS.map((knob) => [knob.key, knob.kind]),
    ) as Record<ProfileRuntimeKey, "bool" | "number">;

/** Every profile: its picker category id and its tab colour. */
export const PROFILES = [
    { id: "InWater-ASeed", color: "#0000FF" },
    { id: "InWater-AGold", color: "#22DD00" },
    { id: "InWater-ACopper", color: "#DD22FF" },
    { id: "InGold-ASeed", color: "#AA2299" },
    { id: "InGold-AGold", color: "#FFFF00" },
    { id: "InGold-ACopper", color: "#FF9900" },
    { id: "InCopper-ASeed", color: "#FF0055" },
] as const satisfies readonly { id: string; color: string }[];

export type ProfileId = (typeof PROFILES)[number]["id"];

/** Every profile id, in picker order. */
export const PROFILE_IDS: readonly ProfileId[] = PROFILES.map((profile) => profile.id);

/** Picker categories — one tab per profile. */
export const PROFILE_CATEGORIES: BufferControlsCategoryLabels[] = PROFILES.map(
    (profile) => ({ id: profile.id, color: profile.color }),
);

/**
 * Per-profile default overrides — only the knobs where a profile differs from
 * `PROFILE_KNOBS`.
 */
const PROFILE_DEFAULT_OVERRIDES: Partial<Record<ProfileId, Partial<ProfileRuntimeConfig>>> = {
    "InGold-ASeed": { growEnabled: true, crystalEnabled: true },
    "InCopper-ASeed": { growEnabled: true, crystalEnabled: true },
};

/** One profile's knobs → that profile's default values. */
function knobDefaults(id: ProfileId): ProfileRuntimeConfig {
    const values: Record<string, boolean | number> = {};
    for (const knob of PROFILE_KNOBS) values[knob.key] = knob.default;
    Object.assign(values, PROFILE_DEFAULT_OVERRIDES[id]);
    return values as ProfileRuntimeConfig;
}

/**
 * Every profile's defaults — the worker's fallback for a missing buffer value,
 * and the values the record is seeded with.
 */
export const PROFILE_DEFAULTS: Readonly<Record<ProfileId, ProfileRuntimeConfig>> =
    Object.fromEntries(
        PROFILES.map((profile) => [profile.id, knobDefaults(profile.id)]),
    ) as Record<ProfileId, ProfileRuntimeConfig>;

/** The buffer path of one knob on one profile. */
const fieldPath = (id: ProfileId, key: ProfileRuntimeKey): string => `P.${id}.${key}`;

/**
 * The buffer field list — one entry per profile × knob, carrying the path, its
 * default, its own art and its explicit tag / category.
 *
 * `registerBufferControls` consumes this list: it derives the JsonBuffer record,
 * the sprite list and the picker tabs from it, so `defaultRecord`, `sprites`,
 * `categories` and the tag/category lookup are never hand-written again.
 */
export const PROFILE_FIELDS: readonly BufferControlsField[] = PROFILES.flatMap((profile) =>
    PROFILE_KNOBS.map((knob) => {
        const key = knob.key as ProfileRuntimeKey;
        return {
            path: fieldPath(profile.id, key),
            kind: knob.kind,
            default: PROFILE_DEFAULTS[profile.id][key],
            sprite: knob.sprite,
            tag: knob.key,
            category: profile.id,
        };
    })
);

/** Shape of the jsonBuffer record. */
export interface ProfileConfigRecord {
    P: Record<ProfileId, ProfileRuntimeConfig>;
}

/** Initial picker item: the first profile's enabled switch. */
export const PROFILE_INITIAL_ITEM_ID = fieldPath(PROFILE_IDS[0], "enabled");

/** Fresh, fully-populated record — the same derivation the package uses. */
export function buildDefaultProfileRecord(): ProfileConfigRecord {
    return buildFieldsRecord<ProfileConfigRecord>(PROFILE_FIELDS);
}