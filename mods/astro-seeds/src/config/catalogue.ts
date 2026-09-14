/**
 * Astro-seeds element catalogue — grouped configuration.
 *
 * Single source of truth for every facet of an element: identity, visual,
 * physics, toolbox label and worker role. Add a field here and registration,
 * i18n, panel toolbox and profiles follow without a second source of truth.
 */

import { AstroElementConfig, AstroElementSpec, ReactionSpec } from "../element/types.ts";
import { astroCopperCrystal } from "./elementConf/astroCopperCrystal.ts";
import { astroCopperPowder } from "./elementConf/astroCopperPowder.ts";
import { astroGoldCrystal } from "./elementConf/astroGoldCrystal.ts";
import { astroGoldPowder } from "./elementConf/astroGoldPowder.ts";
import { astroSeed } from "./elementConf/astroSeed.ts";
import { astroVoidSeed } from "./elementConf/astroVoidSeed.ts";
import { astroWaterCrystal } from "./elementConf/astroWaterCrystal.ts";
import { astroWaterPowder } from "./elementConf/astroWaterPowder.ts";

export type TVanillaElementKey =
    | "liquidGold"
    | "liquidCopper"
    | "florinol"
    | "voidPetal"
    | "seedBase"
    | "fire"
    | "water";

export type TAddedElementKey =
    | "astroVoidSeed"
    | "astroSeed"
    | "astroGoldCrystal"
    | "astroGoldPowder"
    | "astroCopperCrystal"
    | "astroCopperPowder"
    | "astroWaterCrystal"
    | "astroWaterPowder";

export type TElementKey = TVanillaElementKey | TAddedElementKey;

// ---------------------
// ---------------------
// ---------------------

export const ASTRO_ELEMENTS = [
    astroCopperCrystal,
    astroCopperPowder,
    astroGoldCrystal,
    astroGoldPowder,
    astroSeed,
    astroVoidSeed,
    astroWaterCrystal,
    astroWaterPowder,
] as const satisfies readonly AstroElementConfig<TElementKey>[];

// ---------------------
// ---------------------
// ---------------------

// Generic helper — reusable for any tuple of AstroElementConfig
export type AstroElementKeys<T extends readonly AstroElementConfig<TElementKey>[]> =
    T[number]["spec"]["key"];

/** Key → spec lookup (registration, i18n, panel). */
export const ASTRO_ELEMENT_BY_KEY: Record<TElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.spec.key, e.spec]),
) as Record<TElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec<TElementKey>[] = ASTRO_ELEMENTS.flatMap((c) =>
    c.reactions
);
