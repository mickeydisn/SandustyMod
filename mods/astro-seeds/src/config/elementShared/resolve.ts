/**
 * Astro-seeds element ids — single resolved type map.
 *
 * Vanilla (built-in) ids resolve via alias lists; astro ids derive from the
 * main catalogue so registration and resolution never drift apart.
 *
 * Shared by both threads:
 * - Main: astro entries are 0 until `registerElements()` fills them in.
 * - Worker: astro entries resolve because main registered first.
 */
import "@sandmd/sandkit";
import { safe } from "./util.ts";
import type { TElementType } from "@sandmd/shared";
import { ASTRO_ELEMENTS } from "../elementMain/catalogue.ts";
import type { TVanillaElementKey } from "./keys.ts";

function resolveType(ids: string[]): TElementType {
    for (const id of ids) {
        const t = safe(() => sandkit.api.elements.getTypeFromId(id));
        if (t != null) return t;
    }
    return 0;
}

/** Alias lists for built-in elements (first hit wins). */
const VANILLA_ALIASES: Record<TVanillaElementKey, string[]> = {
    liquidGold: ["liquidGold", "liquidgold", "LiquidGold", "goldLiquid", "liquid_gold"],
    liquidCopper: ["liquidCopper", "liquidcopper", "LiquidCopper", "copperLiquid", "liquid_copper"],
    florinol: ["florinol", "Florinol", "florin", "Florin"],
    voidPetal: ["voidPetal", "voidpetal", "VoidPetal", "void_petal", "petalium"],
    seedBase: ["seed", "Seed"],
    fire: ["fire", "Fire"],
    water: ["water", "Water"],
    sand: ["sand", "Sand"],
    empty: ["empty", "Empty", "air", "Air", "void", "Void", "none", "None"],
};

function resolveVanilla(): Record<TVanillaElementKey, TElementType> {
    return Object.fromEntries(
        Object.entries(VANILLA_ALIASES).map(([key, aliases]) => [key, resolveType(aliases)]),
    ) as Record<TVanillaElementKey, TElementType>;
}

function resolveAstro(): Record<string, TElementType> {
    return Object.fromEntries(
        ASTRO_ELEMENTS.map((e) => [e.spec.key, resolveType([e.spec.id])]),
    );
}

/**
 * Resolved element-type numbers shared by main and worker.
 */
export const ElementType: Record<string, TElementType> = {
    ...resolveVanilla(),
    ...resolveAstro(),
} as Record<string, TElementType>;
