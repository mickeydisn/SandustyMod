/**
 * Generic element-profile builder — one factory for every seed behaviour.
 *
 * A `ProfileSpec` is declarative data (keys + live `() => number` thunks).
 * `createElementProfileFactory()` turns that data into a `() => Profile`
 * closure, so adding a new element means adding one spec — no new function.
 */
import type { CrystallizeFn, GrowFn, MoveFn, Profile } from "@sandmd/element-profiles";
import { Crystallization, Grow, Move } from "@sandmd/element-profiles";
import { ASTRO_FIELD } from "../config/ids.ts";
import { ElementType } from "../shared/resolve.ts";
import type { CrystalSpec, GrowSpec, MoveSpec, ProfileSpec } from "../element/types.ts";

/**
 * Resolve catalogue keys → numeric element types.
 *
 * Called from inside `getProfile()`, i.e. per tick, NOT at module scope:
 * `ElementType[key]` is only meaningful after the main thread has registered
 * the elements, so a catalogue file must never capture these numbers itself.
 */
function keysOf<ElType extends string>(keys?: ElType[]): number[] | undefined {
    return keys?.map((k) => ElementType[k as string]);
}

/** One key → numeric type. `undefined`/`"empty"` means "clear to empty". */
function keyOf<ElType extends string>(key?: ElType | "empty"): number | null {
    return key == null || key === "empty" ? null : (ElementType[key as string] ?? null);
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
        else if (spec.kind === "random") out.push(Move.random(spec.chance, spec.mask));
        else if (spec.kind === "channel") {
            out.push(Move.channel({
                matchTypes: keysOf<ElType>(spec.matchKeys),
                matchEmpty: spec.matchEmpty,
                weight: spec.weight,
                rate: spec.rate,
                chance: spec.chance,
                excludeTypes: keysOf<ElType>(spec.excludeKeys),
                mask: spec.mask,
            }));
        } else if (spec.kind === "trailEat") {
            out.push(Move.trailEat({ chance: spec.chance, replaceType: keyOf(spec.replaceKey) }));
        } else if (spec.kind === "columnForce") {
            out.push(Move.columnForce({
                rateFn: spec.rate,
                matchTypes: keysOf<ElType>(spec.matchKeys) ?? [],
                directions: spec.directions,
                rangeNFn: spec.rangeN,
                maxKFn: spec.maxK,
                freeTypes: keysOf<ElType>(spec.freeKeys) ?? [],
                excludeTypes: keysOf<ElType>(spec.excludeKeys) ?? [],
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
    if (spec.kind === "eat") {
        return Grow.eat({
            chance: spec.chance,
            replaceType: keyOf(spec.replaceKey),
            // Omit = profile's own liquid (Grow.eat resolves it per tick).
            matchTypes: keysOf<ElType>(spec.matchKeys),
        });
    }
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
