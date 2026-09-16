/**
 * Element-profiles — the shared, serializable profile surface.
 *
 * A `Profile` describes one simulation behaviour: a seed element that stages
 * "age" while it sits over a liquid, and either crystallises or moves once a
 * condition is met. This module is pure data + types with no engine access, so
 * it can be shared verbatim between the worker (which simulates) and the main
 * thread (which edits config via the panel).
 */
import type { TElementType } from "@sandmd/shared";
import type { DirectionName } from "@sandmd/shared";

export interface Vec2 {
    x: number;
    y: number;
}

export interface Profile {
    id: string;
    seedType: TElementType;
    liquidType: TElementType;
    crystalType: TElementType;
    /** Per-instance data-field index that holds the seed's accumulated age. */
    ageField: number;
    growAge: () => number;
    moves: MoveFn[];
    grow: GrowFn[];
    crystallization: CrystallizeFn[];
}

export type MoveFn = (ctx: Ctx) => Ctx;
export type GrowFn = (ctx: Ctx) => GrowResult;
export type CrystallizeFn = (ctx: Ctx) => boolean;

export interface SenseMatrix {
    /** Odd window size (3, 5, 7…). */
    size: number;
    /** Half-size: `offsets` run over `x,y ∈ [-half..half]`. */
    half: number;
    /** Resolved element type per window cell, row-major (0 = empty). */
    cells: Int32Array;
    /** Centre index (the seed's own cell). */
    center: number;
}

export interface Ctx {
    x: number;
    y: number;
    profile: Profile;
    /**
     * 5x5 sense window sampled once per tick by the pipeline.
     * Every move/grow/crystallize fn reads neighbour types from here —
     * no further engine reads on the hot path.
     */
    sense: SenseMatrix;
    /**
     * Additive vote matrix the pipeline reduces with the centroid rule.
     * Move fns add their (single-channel) votes here; the pipeline owns
     * the only allocation. `votes[center]` is ignored by the reducer.
     */
    votes: Float64Array;
    age: number;
    blocked: boolean;
    tryInstant: boolean;
    stuck: boolean;
    /**
     * Deferred trail-eat requests collected by `Move.trailEat()` intents.
     * Applied by the pipeline to the origin cell *after* a successful swap.
     * `replaceType: null` = clear to empty, otherwise `replaceAtCell`.
     */
    trailEat: TrailEat[];
}

export interface TrailEat {
    chance: number | (() => number);
    replaceType: TElementType | null;
}

export interface GrowResult {
    matched: boolean;
    delta: number;
    tag: string | null;
    rate?: number;
}

/**
 * Serializable description of a single `Move.columnForce()` entry.
 * Serialized to a JSON string by the panel and parsed back on the worker.
 * Non-serializable rate/range/maxK are stored as plain numbers so the whole
 * object survives JSON.stringify/JSON.parse.
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

/** Shape of the JSON string carried by a mod's `columnForce` shared buffer. */
export interface ForceConfig {
    columnForce: ColumnForceEntry[];
}
