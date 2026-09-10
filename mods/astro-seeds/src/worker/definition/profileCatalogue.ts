/**
 * Astro-seeds profile catalogue — one grouped spec per seed behaviour.
 *
 * Each entry groups every aspect of an element's simulation. The generic
 * `createElementProfileFactory` builds the lazy closures, so adding a
 * conf = adding one spec object. Reusable via createProfileFactories.
 */
import { forceEntries, WaterCfg } from "./config.ts";
import type { ProfileSpec } from "./elementProfileFactory.ts";
import { createElementProfileFactory, createProfileFactories } from "./elementProfileFactory.ts";

/** All seed behaviours, grouped per element. */
export const PROFILE_SPECS: readonly ProfileSpec[] = [
    {
        id: "astroSeed-in-gold",
        seedKey: "astroSeed",
        liquidKey: "liquidGold",
        crystalKey: "astroGoldCrystal",
        growAge: 40,
        moves: [
            { kind: "side", chance: 15 },
            { kind: "down", chance: 20 },
        ],
        grow: [{ kind: "ageAlways" }],
        crystallization: [{ kind: "disk", radius: 1 }],
    },
    {
        id: "astroSeed-in-copper",
        seedKey: "astroSeed",
        liquidKey: "liquidCopper",
        crystalKey: "astroCopperCrystal",
        growAge: 10,
        moves: [
            { kind: "up", chance: 0 },
            { kind: "side", chance: 15 },
            { kind: "down", chance: 35 },
        ],
        grow: [
            { kind: "blockOn", blockKey: "water" },
            { kind: "instantChance", rate: 0 },
            { kind: "ageOnFloor", rate: 60 },
            { kind: "ageOnWall", rate: 70 },
            { kind: "ageOnAir", rate: 30 },
            { kind: "ageOnCrystal", rate: 100 },
        ],
        crystallization: [{ kind: "cross", radius: 1 }],
    },
    {
        id: "astroGold-in-water",
        seedKey: "astroGoldPowder",
        liquidKey: "water",
        crystalKey: "astroGoldCrystal",
        growAge: 10,
        moves: [
            { kind: "up", chance: 8 },
            { kind: "side", chance: 8 },
            { kind: "down", chance: 8 },
            {
                kind: "columnForce",
                opts: { rate: -80, rangeN: 8, maxK: 1, directions: ["top", "bottom", "sides"] },
            },
            {
                kind: "columnForce",
                opts: {
                    rate: -10,
                    rangeN: 2,
                    maxK: 1,
                    directions: ["top", "bottom", "sides", "cross"],
                    matchKeys: ["astroGoldPowder"],
                },
            },
            {
                kind: "columnForce",
                opts: {
                    rate: 90,
                    rangeN: 6,
                    maxK: 1,
                    directions: ["top", "bottom", "sides", "cross"],
                    matchKeys: ["astroCopperPowder"],
                },
            },
        ],
        grow: [],
        crystallization: [],
    },
    {
        id: "astroCopper-in-water",
        seedKey: "astroCopperPowder",
        liquidKey: "water",
        crystalKey: "astroCopperCrystal",
        growAge: 10,
        moves: [
            { kind: "up", chance: 5 },
            { kind: "side", chance: 5 },
            { kind: "down", chance: 5 },
            {
                kind: "columnForce",
                opts: { rate: -80, rangeN: 8, maxK: 1, directions: ["top", "bottom", "sides"] },
            },
            {
                kind: "columnForce",
                opts: {
                    rate: 30,
                    rangeN: 2,
                    maxK: 1,
                    directions: ["top", "bottom", "sides", "cross"],
                    matchKeys: ["astroGoldPowder"],
                },
            },
            {
                kind: "columnForce",
                opts: {
                    rate: -20,
                    rangeN: 4,
                    maxK: 1,
                    directions: ["top", "bottom", "sides", "cross"],
                    matchKeys: ["astroCopperPowder"],
                },
            },
        ],
        grow: [],
        crystallization: [],
    },
    {
        // Live panel-driven profile: guards + thunks read WaterCfg per build.
        id: "water",
        seedKey: "astroSeed",
        liquidKey: "water",
        crystalKey: "astroWaterCrystal",
        growAge: () => WaterCfg.crystalGrowAge(),
        moves: [
            {
                kind: "gated",
                when: () => WaterCfg.stepForceMove(),
                moves: [{ kind: "columnForceFrom", entries: () => forceEntries() }],
            },
            {
                kind: "gated",
                when: () => WaterCfg.stepMove(),
                moves: [
                    { kind: "up", chance: () => WaterCfg.moveFloat() },
                    { kind: "side", chance: () => WaterCfg.moveSide() },
                    { kind: "down", chance: () => WaterCfg.moveSink() },
                ],
            },
        ],
        grow: [
            { kind: "instantChance", rate: () => WaterCfg.growInstantTouch() },
            { kind: "ageOnFloor", rate: () => WaterCfg.growOnFloor() },
            { kind: "ageOnWall", rate: () => WaterCfg.growOnWall() },
            { kind: "ageOnAir", rate: () => WaterCfg.growOnAir() },
            { kind: "ageOnCrystal", rate: () => WaterCfg.growOnCrystal() },
            {
                kind: "ageOnSurround",
                rate: () => WaterCfg.growIfSurround(),
                minCount: () => WaterCfg.growSurroundMin(),
            },
        ],
        crystallization: [
            {
                kind: "fromShape",
                shape: () => WaterCfg.crystalShape(),
                radius: () => WaterCfg.crystalRadius(),
            },
        ],
        whenGrow: () => WaterCfg.stepGrow(),
        whenCrystal: () => WaterCfg.stepCrystalisation(),
    },
];

/** Generic-built factories — reusable with any conf via createProfileFactories. */
export const profileFactories = createProfileFactories(PROFILE_SPECS);

export const PROFILES: Record<string, () => import("@sandmd/element-profiles").Profile> =
    profileFactories as Record<string, () => import("@sandmd/element-profiles").Profile>;

export const profiles: (() => import("@sandmd/element-profiles").Profile)[] = Object.values(
    profileFactories,
);

// Legacy named accessors (delegate to the generic builder).
export const profileGold = () => createElementProfileFactory(PROFILE_SPECS[0])();
export const profileCopper = () => createElementProfileFactory(PROFILE_SPECS[1])();
export const profileGoldPowder = () => createElementProfileFactory(PROFILE_SPECS[2])();
export const profileCopperPowder = () => createElementProfileFactory(PROFILE_SPECS[3])();
export const profileWater = () => createElementProfileFactory(PROFILE_SPECS[4])();
