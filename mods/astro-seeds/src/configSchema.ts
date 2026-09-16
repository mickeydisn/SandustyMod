/**
 * Single source of truth for water/runtime config.
 * Add a field here → buffer slot, defaults, and panel row follow.
 */
import { TElementType } from "@sandmd/shared";

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
    // move
    {
        index: 3,
        key: "stepMove",
        kind: "bool",
        section: "move",
        label: "Movement",
        default: true,
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
