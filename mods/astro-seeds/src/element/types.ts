import type { ColumnForceEntry, CompassGroup } from "@sandmd/element-profiles";

// ------------------------------------__

// = Live numeric thunk — a literal or a `() => number` resolved per tick.
export type NumThunk = number | (() => number);

// = Per-offset multipliers for a vote channel: nested rows or flat row-major
// (3x3 works inside the 5x5 window: centre-cropped/padded with 0).
// Data-only on purpose, so a spec stays JSON-serializable for the panel.
export type MaskSpec = readonly (readonly number[])[] | readonly number[];

// = Declarative move step: each entry is ONE single-channel vote.
// The pipeline sums all votes into its 5x5 matrix and reduces once
// (centroid rule), so stacking entries = multi-channel behaviour.
// Fields sit inline on the spec (no nested `opts`) — `kind` plus the
// channel's own options, exactly like `Move.channel(...)` spread out.
export type MoveSpec<ElType extends string> =
    | { kind: "up"; chance: NumThunk; when?: () => boolean }
    | { kind: "side"; chance: NumThunk; when?: () => boolean }
    | { kind: "down"; chance: NumThunk; when?: () => boolean }
    | { kind: "random"; chance: NumThunk; mask?: MaskSpec; when?: () => boolean }
    | ({ kind: "channel"; when?: () => boolean } & ChannelSpec<ElType>)
    | ({ kind: "columnForce"; when?: () => boolean } & ColumnForceSpec<ElType>)
    | { kind: "columnForceFrom"; entries: () => readonly ColumnForceEntry[]; when?: () => boolean }
    | ({ kind: "trailEat"; when?: () => boolean } & TrailEatSpec<ElType>)
    | ({ kind: "memory"; when?: () => boolean } & MemorySpec)
    | ({ kind: "inertia"; when?: () => boolean } & InertiaSpec)
    | { kind: "gated"; when: () => boolean; moves: MoveSpec<ElType>[] };

/**
 * Vote-memory channel — mirrors `Move.memory`. Re-votes each neighbour's
 * stored movement vector (needs `memField` on the profile, see
 * `ProfileSpec.memField`). Positive weight = flow alignment, negative =
 * anti-align.
 */
export interface MemorySpec {
    /** 0-100 chance gate per tick. Default 100. */
    chance?: NumThunk;
    /** Signed alignment strength. Negative = anti-align (disperse). */
    weight: NumThunk;
    /** Global multiplier on `weight`. */
    rate?: NumThunk;
    /** Per-offset multipliers. Omit = all 1. Centre is always ignored. */
    mask?: MaskSpec;
}

/**
 * Inertia channel with key indirection — mirrors `Move.inertia`. Builds a
 * vote matrix from the seed's OWN stored movement vector (needs `memField`,
 * see `ProfileSpec.memField`) instead of scanning neighbours: offsets along
 * last tick's flow vote in, offsets behind vote out.
 */
export interface InertiaSpec {
    /** 0-100 chance gate per tick. Default 100. */
    chance?: NumThunk;
    /** Signed strength along the flow. Negative = move against last flow. */
    weight: NumThunk;
    /** Global multiplier on `weight`. */
    rate?: NumThunk;
    /** Per-offset multipliers. Omit = all 1. Centre is always ignored. */
    mask?: MaskSpec;
    /**
     * `"full"` (default): cells behind the flow vote negatively.
     * `"ahead"`: only offsets in the flow hemisphere vote.
     */
    mode?: "full" | "ahead";
}

/** ColumnForce with key indirection — mirrors `Move.columnForce` opts. */
export interface ColumnForceSpec<ElType extends string> {
    /** Attract (+) / repel (-). 0 = off. */
    rate: NumThunk;
    /** Compass groups to cast from. Default `["bottom"]`. */
    directions: CompassGroup[];
    /** Max ray length in cells. Default 10. */
    rangeN: NumThunk;
    /** Max rays allowed to vote per tick. Default 3. */
    maxK: NumThunk;
    /** Keys that make the ray opaque and vote; empty = any non-excluded. */
    matchKeys?: ElType[];
    /** Extra transparent keys (liquid is always transparent). */
    freeKeys?: ElType[];
    /** Keys the ray never votes for (seed key is always excluded). */
    excludeKeys?: ElType[];
}

/** Trail-eat with key indirection — mirrors `Move.trailEat` opts. */
export interface TrailEatSpec<ElType extends string> {
    /** 0-100 chance per tick, rolled after the move happened. */
    chance: NumThunk;
    /**
     * Key to stamp on the vacated origin cell after a successful swap.
     * Omit (or `"empty"`) = clear to empty.
     */
    replaceKey?: ElType | "empty";
}

/** Single-channel vote with key indirection — mirrors `Move.channel` opts. */
export interface ChannelSpec<ElType extends string> {
    /**
     * Keys that vote with this channel. Omit = any non-excluded type
     * (the seed itself is always excluded). To match empty space, put
     * the special key `"empty"` in `matchKeys` instead.
     */
    matchKeys?: (ElType | "empty" | "structure")[];
    /** Signed vote strength. Negative = repulsion. */
    weight: NumThunk;
    /** Global multiplier. Negative inverts the channel. */
    rate?: NumThunk;
    /** 0-100 chance gate per tick. */
    chance?: NumThunk;
    /** Keys that never vote (seed key is always excluded). */
    excludeKeys?: ElType[];
    /** Per-offset multipliers. Omit = all 1. Centre is always ignored. */
    mask?: MaskSpec;
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
    | { kind: "blockOn"; blockKey: ElType }
    | ({ kind: "eat" } & GrowEatSpec<ElType>);

/** Grow-eat with key indirection — mirrors `Grow.eat` opts. */
export interface GrowEatSpec<ElType extends string> {
    /** 0-100 chance per tick. */
    chance: NumThunk;
    /**
     * Key to stamp on the eaten neighbour cell.
     * Omit (or `"empty"`) = clear to empty.
     */
    replaceKey?: ElType | "empty";
    /**
     * Which neighbour keys count as food.
     * Omit = the profile's own `liquidKey`.
     */
    matchKeys?: ElType[];
}

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
    // Random tick to run the profile
    tickSpeed?: NumThunk;
    // Maturity
    growAge: NumThunk;
    /**
     * Data field where the pipeline stores this profile's vote vector
     * (`vx` at `memField`, `vy` at `memField + 1`) after each swap.
     * Required for `Move.memory` to see neighbours; omit = no memory.
     */
    memField?: number;
    /** Velocity decay for the stored vector (`v' = v*memDecay + votes`). ~0.9 = momentum. */
    memDecay?: NumThunk;
    /** Flip the stored vector when a pending velocity gets blocked (wall bounce). */
    memBounce?: boolean;
    /**
     * Extra element types the seed may step into besides `liquidKey`
     * (e.g. `["empty"]` to swim out of the liquid into open air).
     * Omit = the move phase can only ever enter `liquidKey` cells.
     */
    passableKeys?: readonly (ElType | "empty" | "structure")[];
    // Pipeline phases
    moves: MoveSpec<ElType>[];
    grow: GrowSpec<ElType>[];
    crystallization: CrystalSpec[];
    // Guards evaluated at build time (e.g. panel toggles)
    whenMove?: () => boolean;
    whenGrow?: () => boolean;
    whenCrystal?: () => boolean;
}

// ------------------------------------
export type AstroElementConfig<ElType extends string> = {
    spec: AstroElementSpec;
    reactions: ReactionSpec<ElType>[];
    profiles?: ProfileSpec<ElType>[];
};

// ------------------------------------__

// = Visual + physics facet of one astro element.
export interface ElementVisual {
    // Identity
    // = Slug appended to `${MOD_ID}:` to form the engine id.
    slug: string;
    name: string;
    description: string;
    // Sprite
    colors: number[][];
    metaColor: number;
    // Physics
    density: number;
    // = Resolved lazily — engine enum may be absent at import time.
    matterType: number;
}

// = One grouped catalogue entry: every facet of an element in one place.
export interface AstroElementSpec extends ElementVisual {
    // Catalogue
    key: string;
    // = Full engine id (`astro.seeds:<slug>`), derived from slug.
    id: string;
    // = Label shown in the panel force-editor toolbox.
    toolboxLabel: string;
    // = True for seeds driven by the worker `element:update` loop.
    isSeed: boolean;
    // = True for static crystal outputs.
    isCrystal: boolean;
}

// ------------------------------------__

// = Contact reaction described with keys (not numeric types).
export interface ReactionSpec<ElType extends string> {
    // Inputs
    inputA: ElType;
    inputB: ElType;
    // Outputs (`null` = consumed)
    outputA: ElType | null;
    outputB: ElType | null;
}
