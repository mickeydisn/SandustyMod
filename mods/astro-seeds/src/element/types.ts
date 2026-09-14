import { CrystalSpec, GrowSpec, MoveSpec, NumThunk } from "../worker/elementProfileFactory.ts";

// -----------------------------------
export type AstroElementConfig<ElType extends string> = {
    spec: AstroElementSpec;
    reactions: ReactionSpec<ElType>[];
    profiles?: ProfileSpec<ElType>[];
};

// ------------------------------------__

// = Visual + physics facet of one astro element (ex `elementConfig.ts`).
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

// ------------------------------------__

// = Full declarative description of one seed profile.
export type ProfileSpec<ElType extends string> = {
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
};
