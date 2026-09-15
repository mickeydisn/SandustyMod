import type { ColumnForceEntry } from "@sandmd/element-profiles";

// ------------------------------------__

// = Live numeric thunk — a literal or a `() => number` resolved per tick.
export type NumThunk = number | (() => number);

// = Declarative move step: basic drift, column-force, or gated group.
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
