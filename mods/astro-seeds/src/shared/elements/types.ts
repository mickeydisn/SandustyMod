/**
 * Astro-seeds element catalogue — types.
 *
 * One grouped description per element (CODE_STYLE §3.2): identity, visual,
 * physics and toolbox concerns live together so `catalogue.ts` is the single
 * source of truth. Worker/main/panel all derive from it.
 */
import type { TElementType } from "@sandmd/types";

export type TVanillaElementKey =
    | "liquidGold"
    | "liquidCopper"
    | "florinol"
    | "voidPetal"
    | "seedBase"
    | "fire"
    | "water";

export type TAstroElementKey =
    | "astroVoidSeed"
    | "astroSeed"
    | "astroGoldCrystal"
    | "astroGoldPowder"
    | "astroCopperCrystal"
    | "astroCopperPowder"
    | "astroWaterCrystal"
    | "astroWaterPowder";

export type TElementTypeKey = TVanillaElementKey | TAstroElementKey;

export type TElementTypeIDs = Record<TElementTypeKey, TElementType>;

/** Visual + physics facet of one astro element (ex `elementConfig.ts`). */
export interface ElementVisual {
    // Identity
    /** Slug appended to `${MOD_ID}:` to form the engine id. */
    slug: string;
    name: string;
    description: string;
    // Sprite
    colors: number[][];
    metaColor: number;
    // Physics
    density: number;
    /** Resolved lazily — engine enum may be absent at import time. */
    matterType: number;
}

/** One grouped catalogue entry: every facet of an element in one place. */
export interface AstroElementSpec extends ElementVisual {
    // Catalogue
    key: TAstroElementKey;
    /** Full engine id (`astro.seeds:<slug>`), derived from slug. */
    id: string;
    /** Label shown in the panel force-editor toolbox. */
    toolboxLabel: string;
    /** True for seeds driven by the worker `element:update` loop. */
    isSeed: boolean;
    /** True for static crystal outputs. */
    isCrystal: boolean;
}

/** Contact reaction described with keys (not numeric types). */
export interface ReactionSpec {
    // Inputs
    inputA: TElementTypeKey;
    inputB: TElementTypeKey;
    // Outputs (`null` = consumed)
    outputA: TElementTypeKey | null;
    outputB: TElementTypeKey | null;
}
