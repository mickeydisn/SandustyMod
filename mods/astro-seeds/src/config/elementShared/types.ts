/**
 * Shared element vocabulary — the types both threads speak.
 *
 * These describe *what an element is* (visuals, physics, key-based reactions).
 * Worker-only behaviour (the `Move`/`Grow` profiles) lives in
 * `config/elementWorker` and is deliberately NOT part of this file, so the main
 * bundle never pulls in `@sandmd/element-profiles`.
 */

/** Visual + physics facet of one astro element. */
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

/** = One element as the engine sees it: identity + registration data. */
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

/** = Contact reaction described with keys (not numeric types). */
export interface ReactionSpec<ElType extends string> {
    // Inputs
    inputA: ElType;
    inputB: ElType;
    // Outputs (`null` = consumed)
    outputA: ElType | null;
    outputB: ElType | null;
}
