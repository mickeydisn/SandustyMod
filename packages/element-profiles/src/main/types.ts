/**
 * Main-builder configuration types.
 */
import type { TElementType } from "@sandmd/shared";
import type { ElementMain } from "../shared/element.ts";

/** Optional research node registered behind a vanilla tech. */
export interface TechNodeConfig {
    /** Full node id, e.g. `${MOD_ID}:astro-seeds`. */
    id: string;
    /** Label i18n key. */
    nameKey: string;
    /** Description i18n key. */
    descriptionKey: string;
    /** Label text registered under `nameKey`. */
    name: string;
    /** Description text registered under `descriptionKey`. */
    description: string;
    /** Research cost. Default `0`. */
    cost?: number;
    /**
     * Vanilla `sandkit.enums.Tech` names to attach to — the first one present
     * wins. Omit (or none present) = no node is registered.
     */
    parents?: readonly string[];
    /** Locale for this node's own strings. Default: the build locale. */
    locale?: string;
}

export interface ElementMainConfig<ElType extends string> {
    /** Catalogue entries (spec + contact reactions), in registration order. */
    elements: readonly ElementMain<ElType>[];
    /**
     * Extra key → element-type entries that reaction keys may reference (e.g.
     * vanilla elements the mod resolved itself). The ids assigned while
     * registering `elements` are merged on top of this map.
     */
    types?: Record<string, TElementType>;
    /** Locale for the element name/description strings. Default `"en"`. */
    locale?: string;
    /** Optional research node. */
    tech?: TechNodeConfig;
}

export interface ElementMainResult {
    /** Resolved engine element type per catalogue key. */
    types: Record<string, TElementType>;
    /** True when a research node was actually registered. */
    techRegistered: boolean;
}
