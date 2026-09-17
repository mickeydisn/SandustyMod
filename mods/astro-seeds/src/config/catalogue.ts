/**
 * Astro-seeds element catalogue — the single configuration for the whole mod.
 *
 * One grouped entry per element: identity, visual, physics, reactions and the
 * worker seed profiles. The main builder registers elements/reactions/i18n from
 * this list, the worker builder derives its seed profiles and hooks from it.
 * Add one entry here and every feature follows — no second source of truth.
 */
import type { AstroElementConfig, AstroElementSpec, ReactionSpec } from "../element/types.ts";
import { astroCopperCrystal } from "./elementConf/astroCopperCrystal.ts";
import { astroCopperPowder } from "./elementConf/astroCopperPowder.ts";
import { astroGoldCrystal } from "./elementConf/astroGoldCrystal.ts";
import { astroGCalloyPowder } from "./elementConf/astroGCalloyPowder.ts";
import { astroSeed } from "./elementConf/astroSeed.ts";
import { astroVoidSeed } from "./elementConf/astroVoidSeed.ts";
import { astroWaterCrystal } from "./elementConf/astroWaterCrystal.ts";
import { astroWaterPowder } from "./elementConf/astroWaterPowder.ts";
import type { TElementKey } from "./keys.ts";
import { astroGoldPowder } from "./elementConf/astroGoldPowder.ts";

// ---------------------
// Single catalogue — every element this mod knows about.
// ---------------------
export const ASTRO_ELEMENTS = [
    astroCopperCrystal,
    astroCopperPowder,
    astroGoldCrystal,
    astroGoldPowder,
    astroGCalloyPowder,
    astroSeed,
    astroVoidSeed,
    astroWaterCrystal,
    astroWaterPowder,
] as const satisfies readonly AstroElementConfig<TElementKey>[];

// ---------------------
// Convenience derived views used by the builders.
// ---------------------

/** Key → spec lookup (registration, i18n). */
export const ASTRO_ELEMENT_BY_KEY: Record<TElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.spec.key, e.spec]),
) as Record<TElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec<TElementKey>[] = ASTRO_ELEMENTS.flatMap((c) =>
    c.reactions
);
