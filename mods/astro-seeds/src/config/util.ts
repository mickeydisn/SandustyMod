/**
 * Astro-seeds element catalogue — grouped configuration.
 *
 * Single source of truth for every facet of an element: identity, visual,
 * physics, toolbox label and worker role. Add a field here and registration,
 * i18n, panel toolbox and profiles follow without a second source of truth.
 */
import { MOD_ID } from "./ids.ts";
import { safe } from "../shared/utils.ts";
import { AstroElementSpec, ReactionSpec } from "../element/types.ts";
import { ASTRO_ELEMENTS, TElementKey } from "./catalogue.ts";

export function matterPowder(): number {
    const MatterType = safe(() => sandkit.enums?.MatterType) as Record<string, number> | null;
    return MatterType?.Powder ?? 8;
}

export function matterStatic(): number {
    const MatterType = safe(() => sandkit.enums?.MatterType) as Record<string, number> | null;
    return MatterType?.Static ?? 5;
}

export function spec(entry: Omit<AstroElementSpec, "id"> & { slug: string }): AstroElementSpec {
    return { ...entry, id: `${MOD_ID}:${entry.slug}` };
}

/** Key → spec lookup (registration, i18n, panel). */
export const ASTRO_ELEMENT_BY_KEY: Record<TElementKey, AstroElementSpec> = Object.fromEntries(
    ASTRO_ELEMENTS.map((e) => [e.spec.key, e.spec]),
) as Record<TElementKey, AstroElementSpec>;

/** Contact reactions described with keys — resolved to types at register time. */
export const ASTRO_REACTIONS: readonly ReactionSpec<TElementKey>[] = ASTRO_ELEMENTS.flatMap((e) =>
    e.reactions
);
