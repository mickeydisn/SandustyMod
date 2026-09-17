import { ProfileSpec } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";

const InCopperProfileList = [
    {
        id: "astroSeed-in-copper",
        seedKey: "astroSeed",
        liquidKey: "liquidCopper",
        crystalKey: "astroCopperCrystal",
        growAge: 40,
        moves: [
            { kind: "up", chance: 0 },
            { kind: "side", chance: 25 },
            { kind: "down", chance: 35 },
        ],
        grow: [
            // { kind: "blockOn", blockKey: "water" },
            { kind: "ageOnSurround", rate: 20, minCount: 4 },
            { kind: "instantChance", rate: 0 },
            { kind: "ageOnFloor", rate: 60 },
            { kind: "ageOnWall", rate: 70 },
            // { kind: "ageOnAir", rate: 30 },
            { kind: "ageOnCrystal", rate: 100 },
        ],
        crystallization: [{ kind: "cross", radius: 2 }],
    },
] as const satisfies readonly ProfileSpec<TElementKey>[];

function indexByType<const T extends readonly ProfileSpec<TElementKey>[]>(
    list: T,
): Record<T[number]["seedKey"], T[number]> {
    return Object.fromEntries(list.map((x) => [x.seedKey, x])) as Record<
        T[number]["seedKey"],
        T[number]
    >;
}

export const InCopperProfile = indexByType(InCopperProfileList);
