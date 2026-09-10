/**
 * Astro-seeds element catalogue — grouped configuration.
 *
 * Single source of truth for every facet of an element: identity, visual,
 * physics, toolbox label and worker role. Add a field here and registration,
 * i18n, panel toolbox and profiles follow without a second source of truth.
 */
import type { AstroElementSpec, ReactionSpec, TAstroElementKey } from "../shared/types.ts";

export const ASTRO_ELEMENTS: readonly AstroElementSpec[] = [];
/** Ordered catalogue — index order is the registration order. */
export const ASTRO_ELEMENTS: readonly AstroElementSpec[] = [];

/** Key → spec lookup (registration, i18n, panel). */
export const ASTRO_ELEMENT_BY_KEY: Record<TAstroElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.key, e]),
) as Record<TAstroElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec[] = [
    { inputA: "seedBase", inputB: "voidPetal", outputA: "astroVoidSeed", outputB: null },
    { inputA: "astroGoldCrystal", inputB: "fire", outputA: "astroGoldPowder", outputB: "fire" },
    { inputA: "astroVoidSeed", inputB: "florinol", outputA: "astroSeed", outputB: null },
    { inputA: "astroCopperCrystal", inputB: "fire", outputA: "astroCopperPowder", outputB: "fire" },
    { inputA: "astroWaterCrystal", inputB: "fire", outputA: "astroWaterPowder", outputB: "fire" },
];
