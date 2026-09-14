/**
 * Generic element-profile builder — one factory for every seed behaviour.
 *
 * A `ProfileSpec` is declarative data (keys + live `() => number` thunks).
 * `createElementProfileFactory()` turns that data into a `() => Profile`
 * closure, so adding a new element means adding one spec — no new function.
 */
import type {
    ColumnForceEntry,
    CrystallizeFn,
    GrowFn,
    MoveFn,
    Profile,
} from "@sandmd/element-profiles";
import { Crystallization, Grow, Move } from "@sandmd/element-profiles";
import { ASTRO_FIELD } from "../config/ids.ts";
import { ElementType } from "../shared/resolve.ts";

/** Live numeric thunk — literal or config reader, resolved per tick. */
export type NumThunk = number | (() => number);

/** Declarative move step: basic drift, column-force, or gated group. */
export type MoveSpec<ElType extends string> =
    | { kind: "up"; chance: NumThunk; when?: () => boolean }
    | { kind: "side"; chance: NumThunk; when?: () => boolean }
    | { kind: "down"; chance: NumThunk; when?: () => boolean }
    | { kind: "columnForce"; opts: ColumnForceOptsSpec<ElType>; when?: () => boolean }
    | { kind: "columnForceFrom"; entries: () => readonly ColumnForceEntry[]; when?: () => boolean }
    | { kind: "gated"; when: () => boolean; moves: MoveSpec<ElType>[] };

/** ColumnForce options with thunks — mirrors `Move.columnForce` opts. */
export interface ColumnForceOptsSpec<ElType extends string> {
    // Rate / shape
    rate: NumThunk;
    rangeN: NumThunk;
    maxK: NumThunk;
    // Direction + type sets (keys resolved lazily at build time)
    directions: string[];
    matchKeys?: ElType[];
    freeKeys?: ElType[];
    excludeKeys?: ElType[];
}

/** Declarative grow step. */
export type GrowSpec<ElType extends string> =
    | { kind: "ageAlways" }
    | { kind: "instantChance"; rate: NumThunk }
    | { kind: "ageOnFloor"; rate: NumThunk }
    | { kind: "ageOnWall"; rate: NumThunk }
    | { kind: "ageOnAir"; rate: NumThunk }
    | { kind: "ageOnCrystal"; rate: NumThunk }
    | { kind: "ageOnSurround"; rate: NumThunk; minCount: NumThunk }
    | { kind: "blockOn"; blockKey: ElType };

/** Declarative crystallization step. */
export type CrystalSpec =
    | { kind: "disk"; radius: NumThunk }
    | { kind: "cross"; radius: NumThunk }
    | { kind: "ring"; radius: NumThunk }
    | { kind: "column"; radius: NumThunk }
    | { kind: "single" }
    | { kind: "fromShape"; shape: NumThunk; radius: NumThunk };

/** Full declarative description of one seed profile. */
export interface ProfileSpec<ElType extends string> {
    // Identity
    id: string;
    seedKey: ElType;
    liquidKey: ElType;
    crystalKey: ElType;
    // Maturity
    growAge: NumThunk;
    // Pipeline phases
    moves: MoveSpec<ElType>[];
    grow: GrowSpec<ElType>[];
    crystallization: CrystalSpec[];
    // Guards evaluated at build time (e.g. panel toggles)
    whenMove?: () => boolean;
    whenGrow?: () => boolean;
    whenCrystal?: () => boolean;
}

function buildMoves<ElType extends string>(specs: MoveSpec<ElType>[]): MoveFn[] {
    const out: MoveFn[] = [];
    for (const spec of specs) {
        if (spec.kind === "gated") {
            if (!spec.when()) continue;
            out.push(...buildMoves(spec.moves));
            continue;
        }
        if (spec.when && !spec.when()) continue;
        if (spec.kind === "up") out.push(Move.up(spec.chance));
        else if (spec.kind === "side") out.push(Move.side(spec.chance));
        else if (spec.kind === "down") out.push(Move.down(spec.chance));
        else if (spec.kind === "columnForce") {
            const o = spec.opts;
            out.push(Move.columnForce({
                rateFn: o.rate,
                matchTypes: (o.matchKeys ?? []).map((k) => ElementType[k as string]),
                directions: [...o.directions] as never,
                rangeNFn: o.rangeN,
                maxKFn: o.maxK,
                freeTypes: (o.freeKeys ?? []).map((k) => ElementType[k as string]),
                excludeTypes: (o.excludeKeys ?? []).map((k) => ElementType[k as string]),
            }));
        } else {
            for (const e of spec.entries()) {
                out.push(Move.columnForce({
                    rateFn: e.rateFn,
                    matchTypes: [...e.matchTypes],
                    directions: [...e.directions],
                    rangeNFn: e.rangeNFn,
                    maxKFn: e.maxKFn,
                    freeTypes: [...e.freeTypes],
                    excludeTypes: [...e.excludeTypes],
                }));
            }
        }
    }
    return out;
}

function buildGrow<ElType extends string>(spec: GrowSpec<ElType>): GrowFn {
    if (spec.kind === "ageAlways") return Grow.ageAlways();
    if (spec.kind === "instantChance") return Grow.instantChance(spec.rate);
    if (spec.kind === "ageOnFloor") return Grow.ageOnFloor(spec.rate);
    if (spec.kind === "ageOnWall") return Grow.ageOnWall(spec.rate);
    if (spec.kind === "ageOnAir") return Grow.ageOnAir(spec.rate);
    if (spec.kind === "ageOnCrystal") return Grow.ageOnCrystal(spec.rate);
    if (spec.kind === "ageOnSurround") return Grow.ageOnSurround(spec.rate, spec.minCount);
    return Grow.blockOn(ElementType[spec.blockKey as string]);
}

function buildCrystal(spec: CrystalSpec): CrystallizeFn {
    if (spec.kind === "disk") return Crystallization.disk(spec.radius);
    if (spec.kind === "cross") return Crystallization.cross(spec.radius);
    if (spec.kind === "ring") return Crystallization.ring(spec.radius);
    if (spec.kind === "column") return Crystallization.column(spec.radius);
    if (spec.kind === "single") return Crystallization.single();
    return Crystallization.fromShapeIndex(spec.shape, spec.radius);
}

/**
 * Generic factory: declarative spec in, lazy `() => Profile` out.
 * Type/age lookups stay lazy so worker config + registration order work.
 */
export function createElementProfileFactory<ElType extends string>(
    spec: ProfileSpec<ElType>,
): () => Profile {
    return () => ({
        id: spec.id,
        seedType: ElementType[spec.seedKey as string],
        liquidType: ElementType[spec.liquidKey as string],
        crystalType: ElementType[spec.crystalKey as string],
        ageField: ASTRO_FIELD.AGE,
        growAge: () => (typeof spec.growAge === "function" ? spec.growAge() : spec.growAge),
        moves: spec.whenMove && !spec.whenMove() ? [] : buildMoves(spec.moves),
        grow: spec.whenGrow && !spec.whenGrow() ? [] : spec.grow.map(buildGrow),
        crystallization: spec.whenCrystal && !spec.whenCrystal()
            ? []
            : spec.crystallization.map(buildCrystal),
    });
}

/** Build many factories from many specs — the multi-conf entry point. */
export function createProfileFactories<ElType extends string>(
    specs: readonly ProfileSpec<ElType>[],
): Record<string, () => Profile> {
    return Object.fromEntries(specs.map((s) => [s.id, createElementProfileFactory(s)]));
}
