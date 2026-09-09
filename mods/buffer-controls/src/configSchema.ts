/**
 * Single source of truth for water/runtime config.
 * Add a field here → buffer slot, defaults, and panel row follow.
 */
import { TElementType } from "@sandmd/types";

export const BUF_LENGTH = 32;

/**
 * Length (in bytes) of the uint8 JSON buffer that carries the ForceConfig
 * string built by the panel and parsed back by the worker.
 */
export const JSON_BUF_LENGTH = 2048;

/**
 * Reuses the buffer slot that used to hold the `moveContact` value (index 7).
 * The panel bumps this counter every time it writes a new JSON string; the
 * worker uses it as a change signal to refresh its parsed cache.
 */
export const JSON_COUNTER_INDEX = 7;

export type FieldKind = "bool" | "number";

export interface ConfigField {
    /** Buffer index 0..BUF_LENGTH-1 */
    index: number;
    /** Stable key (state + settings id) */
    key: string;
    kind: FieldKind;
    /** Panel section id */
    section: "master" | "move" | "grow" | "crystal";
    label: string;
    /** Defaults must be false or 0 */
    default: boolean | number;
    min?: number;
    max?: number;
    /** Show only when this bool key is true (optional) */
    when?: string;
}

/** Ordered fields — indices must stay unique and stable across versions. */
export const CONFIG_FIELDS = [
    // master (panel toggles at top)
    {
        index: 0,
        key: "enabled",
        kind: "bool",
        section: "master",
        label: "Mod active",
        default: true,
    },
    {
        index: 1,
        key: "debugLog",
        kind: "bool",
        section: "master",
        label: "Debug log",
        default: false,
    },
    {
        index: 2,
        key: "waterEnabled",
        kind: "bool",
        section: "master",
        label: "Water profile",
        default: true,
    },

    // move
    {
        index: 3,
        key: "stepMove",
        kind: "bool",
        section: "move",
        label: "Movement",
        default: true,
    },
    {
        index: 4,
        key: "moveSide",
        kind: "number",
        section: "move",
        label: "Side %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepMove",
    },
    {
        index: 5,
        key: "moveFloat",
        kind: "number",
        section: "move",
        label: "Float %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepMove",
    },
    {
        index: 6,
        key: "moveSink",
        kind: "number",
        section: "move",
        label: "Sink %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepMove",
    },

    // index 7 (old moveContact slot) is reused as JSON_COUNTER_INDEX by the
    // panel (uint8 JSON buffer change signal) — see JSON_COUNTER_INDEX.
    {
        index: 20,
        key: "stepForceMove",
        kind: "bool",
        section: "move",
        label: "Column forces",
        default: false,
    },

    // grow
    {
        index: 8,
        key: "stepGrow",
        kind: "bool",
        section: "grow",
        label: "Grow",
        default: false,
    },
    {
        index: 9,
        key: "growInstantTouch",
        kind: "number",
        section: "grow",
        label: "Instant %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 10,
        key: "growOnAir",
        kind: "number",
        section: "grow",
        label: "Air %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 11,
        key: "growOnWall",
        kind: "number",
        section: "grow",
        label: "Wall %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 12,
        key: "growOnFloor",
        kind: "number",
        section: "grow",
        label: "Floor %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 13,
        key: "growOnCrystal",
        kind: "number",
        section: "grow",
        label: "Crystal %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 14,
        key: "growIfSurround",
        kind: "number",
        section: "grow",
        label: "Surround %",
        default: 0,
        min: 0,
        max: 100,
        when: "stepGrow",
    },
    {
        index: 15,
        key: "growSurroundMin",
        kind: "number",
        section: "grow",
        label: "Surr. min",
        default: 0,
        min: 0,
        max: 8,
        when: "stepGrow",
    },

    // crystal
    {
        index: 16,
        key: "stepCrystalisation",
        kind: "bool",
        section: "crystal",
        label: "Crystallize",
        default: false,
    },
    {
        index: 17,
        key: "crystalGrowAge",
        kind: "number",
        section: "crystal",
        label: "Grow age",
        default: 0,
        min: 0,
        max: 200,
        when: "stepCrystalisation",
    },
    {
        index: 18,
        key: "crystalShape",
        kind: "number",
        section: "crystal",
        label: "Shape 0–4",
        default: 0,
        min: 0,
        max: 4,
        when: "stepCrystalisation",
    },
    {
        index: 19,
        key: "crystalRadius",
        kind: "number",
        section: "crystal",
        label: "Radius",
        default: 0,
        min: 0,
        max: 6,
        when: "stepCrystalisation",
    },
] as const satisfies readonly ConfigField[];

export type ConfigFieldRecord = {
    [F in typeof CONFIG_FIELDS[number] as F["key"]]: F["kind"];
};

export function buildDefaultConfigRecord(): ConfigFieldRecord {
    const state = {} as ConfigFieldRecord;
    for (const f of CONFIG_FIELDS) {
        state[f.key] = f.default as never;
    }
    return state;
}

/** Legacy name → index map for worker (built from schema). */
export const bufField: Record<string, number> = Object.fromEntries(
    CONFIG_FIELDS.map((f) => [f.key, f.index]),
);

export function clampField(f: ConfigField, value: number): number {
    const min = f.min ?? 0;
    const max = f.max ?? 100;
    return Math.max(min, Math.min(max, Math.round(value)));
}

export type DirectionName =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "sides"
    | "cross";
/**
 * Serializable description of a single Move.columnForce() entry.
 * Serialized to a JSON string by the panel and parsed back on the worker.
 * Non-serializable function fields (rangeNFn / maxKFn) are stored as plain
 * numbers so the whole object survives JSON.stringify/JSON.parse.
 */
export interface ColumnForceEntry {
    rateFn: number;
    matchTypes: TElementType[];
    directions: DirectionName[];
    rangeNFn: number;
    maxKFn: number;
    freeTypes: TElementType[];
    excludeTypes: TElementType[];
}

/** Shape of the JSON string carried by the astroJson uint8 shared buffer. */
export interface ForceConfig {
    columnForce: ColumnForceEntry[];
}

/**
 * Starting ForceConfig shown in the panel and used as the worker fallback when
 * the JSON buffer is empty / invalid.
 */
export const DEFAULT_FORCE_CONFIG: ForceConfig = {
    columnForce: [
        {
            rateFn: -50,
            matchTypes: [],
            directions: ["sides"],
            rangeNFn: 10,
            maxKFn: 5,
            freeTypes: [],
            excludeTypes: [],
        },
    ],
};
