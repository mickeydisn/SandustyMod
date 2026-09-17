import { ProfileSpec } from "../../element/types.ts";
import { TElementKey } from "../keys.ts";
import { ASTRO_FIELD } from "../ids.ts";

const MASK_VERT = [[0, 1, 0], [0, 0, 0], [0, 1, 0]]; // orthogonal neighbours
const MASK_SIDE = [[0, 0, 0], [1, 0, 1], [0, 0, 0]]; // orthogonal neighbours
const MASK_CROSS = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]; // orthogonal neighbours
const MASK_PLUS = [[0, 1, 0], [1, 0, 1], [0, 1, 0]]; // orthogonal neighbours
const MASK_ALL = [[1, 1, 1], [1, 0, 1], [1, 1, 1]]; // orthogonal neighbours
const MASK_GRAVITY = [
    [0, 0, 0, 0, 0],
    [0, 0, .5, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0.5, 0, 0],
];
const MASK_OUT = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
];
const MASK_FULL = [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
]; // orthogonal neighbours

const InGoldProfileList = [
    // ==========================
    // ASTRO SEED
    {
        id: "astroSeed-in-gold",
        seedKey: "astroSeed",
        liquidKey: "liquidGold",
        crystalKey: "astroGoldCrystal",
        growAge: 150,
        moves: [
            { kind: "side", chance: 15 },
            { kind: "down", chance: 20 },
            { kind: "channel", chance: 90, matchKeys: ["water"], weight: -1, mask: MASK_FULL },
        ],
        grow: [{ kind: "ageOnSurround", rate: 100, minCount: 4 }],
        crystallization: [{ kind: "disk", radius: 1 }],
    },
    // ==========================
    // ASTRO GOLD POWDER
    {
        id: "astroGold-in-liquid-gold",
        seedKey: "astroGoldPowder",
        liquidKey: "liquidGold",
        crystalKey: "astroGoldCrystal",
        growAge: 10,
        // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
        // memDecay integrates it into a real fading velocity; memBounce
        // reflects it off walls/floor so landing seeds rebound upward.
        memField: ASTRO_FIELD.VX,
        memDecay: 0.1,
        memBounce: true,
        moves: [
            // Jitter — uniform random draw over the 8 neighbours.
            // { kind: "trailEat", chance: 1, replaceKey: "sand" },
            // Jitter — uniform random draw over the 8 neighbours.
            { kind: "random", chance: 80, mask: MASK_SIDE },
            { kind: "random", chance: 80, mask: MASK_VERT },
            // Gravity — liquid gold below pulls the seed down.
            /*
                    {
                        kind: "channel",
                        chance: 1,
                        matchKeys: ["liquidGold"],
                        weight: .1,
                        mask: MASK_GRAVITY,

                    },
                    */
            {
                kind: "channel",
                matchKeys: ["empty", "structure"],
                chance: 100,
                weight: -15,
                mask: MASK_PLUS,
            },
            // Dispersed — own kind beside it pushes back (orthogonal only,
            // so diagonal neighbours stay free to settle).
            { kind: "channel", chance: 90, matchKeys: ["water"], weight: -1, mask: MASK_FULL },
            {
                kind: "channel",
                chance: 80,
                matchKeys: ["astroGoldPowder"],
                weight: -1,
                mask: MASK_ALL,
            },
            {
                kind: "channel",
                chance: 50,
                matchKeys: ["astroGoldPowder"],
                weight: .4,
                mask: MASK_OUT,
            },
            {
                kind: "channel",
                chance: 50,
                matchKeys: ["astroCopperPowder"],
                weight: -15,
                mask: MASK_FULL,
            },
            // Cluster — any nearby copper powder pulls this gold in.
            // { kind: "channel", chance: 20, matchKeys: ["astroCopperPowder"], weight: -2 },
            // Flow memory — align with the movement vector neighbours
            // stored last tick (flocking; keeps drifting seeds coherent).
            // { kind: "memory", chance: 100, weight: .1 },
            // Inertia — own last-tick flow vector drives a matching vote
            // gradient (straight-line persistence on top of flocking).
            { kind: "inertia", chance: 1, weight: .1, mode: "full" },
        ],
        grow: [],
        crystallization: [],
    },
    // ==========================
    // ASTRO COPPER POWDER
    {
        id: "astroCopper-in-liquid-gold",
        seedKey: "astroCopperPowder",
        liquidKey: "liquidGold",
        // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
        // memDecay integrates it into a real fading velocity; memBounce
        // reflects it off walls/floor so landing seeds rebound upward.
        memField: ASTRO_FIELD.VX,
        memDecay: 0.9,
        memBounce: true,
        moves: [
            // Jitter — uniform random draw over the 8 neighbours.
            { kind: "random", chance: 80 },
            // Gravity — liquid gold below pulls the seed down.
            {
                kind: "channel",
                chance: 1,
                matchKeys: ["liquidGold"],
                weight: -.1,
                mask: MASK_GRAVITY,
            },
            { kind: "channel", chance: 90, matchKeys: ["water"], weight: -1, mask: MASK_FULL },
            {
                kind: "channel",
                matchKeys: ["empty", "structure"],
                chance: 100,
                weight: -10,
                mask: MASK_PLUS,
            },
            // Lattice — own kind repels orthogonally but attracts
            // diagonally, so copper settles into diagonal chains instead
            // of stacking into a solid blob.
            {
                kind: "channel",
                chance: 90,
                matchKeys: ["astroCopperPowder"],
                weight: -2,
                mask: MASK_CROSS,
            },
            {
                kind: "channel",
                chance: 90,
                matchKeys: ["astroCopperPowder"],
                weight: 2,
                mask: MASK_PLUS,
            },
            { kind: "channel", chance: 90, matchKeys: ["astroGoldPowder"], weight: 2 },
            { kind: "channel", chance: 90, matchKeys: ["astroGCalloyPowder"], weight: -1 },
            { kind: "memory", chance: 20, weight: .5, mask: MASK_FULL },
            { kind: "inertia", chance: 20, weight: .5, mode: "full" },
        ],
        growAge: 3,
        grow: [
            { kind: "ageOnSurround", minCount: 4, rate: 2, typeId: "astroGoldPowder" },
            { kind: "eat", chance: 1, matchKeys: ["astroGoldPowder"], replaceKey: "empty" },
        ],
        crystalKey: "astroGCalloyPowder",
        crystallization: [
            { kind: "disk", radius: 1 },
        ],
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

export const InGoldProfile = indexByType(InGoldProfileList);
