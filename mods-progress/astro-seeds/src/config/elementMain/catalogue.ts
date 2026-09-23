/**
 * Main-thread element catalogue — everything the engine must be told about.
 *
 * One entry per element: registration spec + contact reactions. The main
 * builder (`main/build.ts`) registers i18n, elements, discoveries and
 * reactions straight from this list; the worker profiles live separately in
 * `config/elementWorker` so the main bundle never imports the simulation
 * actions. Add one entry here and registration follows — no second source of
 * truth for ids, colors or physics.
 */
import type { AstroElementSpec, ReactionSpec } from "../elementShared/types.ts";
import type { TElementKey } from "../elementShared/keys.ts";
import { astroCopperCrystal } from "./astroCopperCrystal.ts";
import { astroCopperPowder } from "./astroCopperPowder.ts";
import { astroGCalloyPowder } from "./astroGCalloyPowder.ts";
import { astroGoldCrystal } from "./astroGoldCrystal.ts";
import { astroGoldPowder } from "./astroGoldPowder.ts";
import { astroSeed } from "./astroSeed.ts";
import { astroVoidSeed } from "./astroVoidSeed.ts";
import { astroWaterCrystal } from "./astroWaterCrystal.ts";
import { astroWaterPowder } from "./astroWaterPowder.ts";
import type { AstroElementMain } from "./types.ts";

// ---------------------
// Single catalogue — every element this mod registers.
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
] as const satisfies readonly AstroElementMain<TElementKey>[];

// ---------------------
// Derived views used by the main builder.
// ---------------------

/** Key → spec lookup (registration, i18n). */
export const ASTRO_ELEMENT_BY_KEY: Record<TElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.spec.key, e.spec]),
) as Record<TElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec<TElementKey>[] = ASTRO_ELEMENTS.flatMap((c) =>
    c.reactions
);
