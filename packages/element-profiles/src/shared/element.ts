/**
 * Shared element vocabulary — the data contract both threads speak.
 *
 * `ElementSpec` is what the main builder registers with the engine;
 * `ReactionSpec` describes a contact reaction by catalogue key; `ElementMain`
 * pairs the two into one catalogue entry.
 *
 * Keys are resolved to engine ids/types by the owning mod (and consumed by the
 * worker builder through `Profile`s), so this module stays pure data + types and
 * is safe to import from the main bundle.
 */

/** Visual + physics facet of one element. */
export interface ElementVisual {
    name: string;
    description: string;
    /** Sprite color variants. */
    colors: number[][];
    metaColor: number;
    density: number;
    /** Engine `MatterType` value (powder / static / …). */
    matterType: number;
}

/** One element as the engine sees it: identity + registration data. */
export interface ElementSpec extends ElementVisual {
    /** Short catalogue key — how the mod refers to this element. */
    key: string;
    /** Full engine id, e.g. `astro.seeds:astro-seed`. */
    id: string;
}

/** Contact reaction described with keys (not numeric types). */
export interface ReactionSpec<ElType extends string> {
    inputA: ElType;
    inputB: ElType;
    /** Outputs (`null` = consumed). */
    outputA: ElType | null;
    outputB: ElType | null;
}

/** One catalogue entry: registration spec + its contact reactions. */
export interface ElementMain<ElType extends string> {
    spec: ElementSpec;
    reactions: ReactionSpec<ElType>[];
}
