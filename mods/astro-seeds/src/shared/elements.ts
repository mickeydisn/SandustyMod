/**
 * Resolved element-type numbers for this mod, shared by main and worker.
 *
 * The base (built-in) element ids resolve at load everywhere. The astro element
 * ids only resolve once they are registered by `registerElement()` on main:
 *  - main thread → astro entries are 0 until `registerElement()` fills them in;
 *  - worker thread → astro entries resolve because main registered first.
 * Both sides import this one map, so there is a single source of truth.
 */
import "@sandmd/sandkit";
import { elementConfig } from "./elementConfig.ts";
import { safe } from "./utils.ts";
import type { TElementType, TElementTypeIDs } from "./elementTypes.ts";

function resolveType(ids: string[]): TElementType {
    for (const id of ids) {
        const t = safe(() => sandkit.api.elements.getTypeFromId(id));
        if (t != null) return t;
    }
    return 0;
}

export const ElementType: TElementTypeIDs = {
    // base (built-in) elements
    liquidGold: resolveType([
        "liquidGold",
        "liquidgold",
        "LiquidGold",
        "goldLiquid",
        "liquid_gold",
    ]),
    liquidCopper: resolveType([
        "liquidCopper",
        "liquidcopper",
        "LiquidCopper",
        "copperLiquid",
        "liquid_copper",
    ]),
    florinol: resolveType(["florinol", "Florinol", "florin", "Florin"]),
    voidPetal: resolveType([
        "voidPetal",
        "voidpetal",
        "VoidPetal",
        "void_petal",
        "petalium",
    ]),
    seedBase: resolveType(["seed", "Seed"]),
    fire: resolveType(["fire", "Fire"]),
    water: resolveType(["water", "Water"]),

    // this mod's elements (id derived from elementConfig)
    astroVoidSeed: resolveType([elementConfig.astroVoidSeed.id]),
    astroSeed: resolveType([elementConfig.astroSeed.id]),
    astroGoldCrystal: resolveType([elementConfig.astroGoldCrystal.id]),
    astroGoldPowder: resolveType([elementConfig.astroGoldPowder.id]),
    astroCopperCrystal: resolveType([elementConfig.astroCopperCrystal.id]),
    astroCopperPowder: resolveType([elementConfig.astroCopperPowder.id]),
    astroWaterCrystal: resolveType([elementConfig.astroWaterCrystal.id]),
    astroWaterPowder: resolveType([elementConfig.astroWaterPowder.id]),
};
