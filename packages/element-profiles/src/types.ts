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

export interface Ctx {
    x: number;
    y: number;
    dx: number;
    dy: number;
    profile: Profile;
    age: number;
    blocked: boolean;
    tryInstant: boolean;
    stuck: boolean;
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
