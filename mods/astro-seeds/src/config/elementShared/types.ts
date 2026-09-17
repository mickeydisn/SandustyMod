/**
 * Mod element vocabulary — the astro types both threads speak.
 *
 * The engine-facing half comes from `@sandmd/element-profiles/shared`
 * (`ElementSpec`/`ReactionSpec`); this file adds the astro catalogue metadata
 * and hides the package import from the per-element files.
 */
import type { ElementSpec, ReactionSpec } from "@sandmd/element-profiles/shared";

/** = One astro element: engine registration fields + astro catalogue metadata. */
export interface AstroElementSpec extends ElementSpec {
    // = Slug appended to `${MOD_ID}:` to form the engine id.
    slug: string;
    // = Label shown in the panel force-editor toolbox.
    toolboxLabel: string;
    // = True for seeds driven by the worker `element:update` loop.
    isSeed: boolean;
    // = True for static crystal outputs.
    isCrystal: boolean;
}

export type { ReactionSpec };
