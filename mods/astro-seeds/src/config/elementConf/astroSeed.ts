import { MatterType } from "@sandmd/shared";
import { forceEntries } from "../../worker/config.ts";
import { ElementConfig } from "../../shared/types.ts";
import { spec } from "../util.ts";

// Extract density — keep seeds just under liquid copper so they sink slowly.
const LIQUID_COPPER_DENSITY = 150;
const SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);

export const astroSeed: ElementConfig = {
    spec: spec({
        key: "astroSeed",
        slug: "astro-seed",
        name: "Astro Seed",
        description: "Liquid Gold / Copper / Water → crystals.",
        colors: [[180, 220, 255], [140, 190, 255], [100, 160, 240], [220, 240, 255]],
        density: SEED_DENSITY,
        metaColor: 0x8ec8ff,
        matterType: MatterType.Static,
        toolboxLabel: "Seed",
        isSeed: true,
        isCrystal: false,
    }),
    reactions: [{
        inputA: "astroVoidSeed",
        inputB: "florinol",
        outputA: "astroSeed",
        outputB: null,
    }],
    profiles: [
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
    ],
};

const astroSeed_Water = {
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
};
