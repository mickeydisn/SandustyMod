/**
 * Seed profiles in **liquid gold**.
 *
 * The two powders use vote memory (`memField`/`memDecay`/`memBounce`) plus
 * inertia channels, so they keep drifting coherently between columns of gold.
 */
import { Crystallization, Grow, Move } from "@sandmd/element-profiles/worker";
import type { Profile } from "@sandmd/element-profiles/shared";
import { ASTRO_FIELD } from "../../ids.ts";
import { ElementType } from "../elementShared/resolve.ts";
import { channelMatch } from "./keys.ts";
import { live } from "./live.ts";
import { MASK } from "./mask.ts";

// ==========================
// ASTRO SEED — drifts, matures into a gold crystal disk; water pushes it away.
const SEED_ID = "InGold-ASeed";
export const astroSeedInGold: Profile = {
    id: SEED_ID,
    seedType: ElementType.astroSeed,
    liquidType: ElementType.liquidGold,
    crystalType: ElementType.astroGoldCrystal,
    tickSpeed: () => live(SEED_ID, "tickSpeed", 50),
    enabled: () => live(SEED_ID, "enabled", true),
    growEnabled: () => true, // live(SEED_ID, "growEnabled", true),
    crystallizationEnabled: true, // () => live(SEED_ID, "crystalEnabled", true),
    ageField: ASTRO_FIELD.AGE,
    growAge: () => 100,
    moves: [
        Move.side(15),
        Move.down(20),
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.water],
            weight: -1,
            mask: MASK.FULL,
        }),
    ],
    grow: [Grow.ageOnSurround(100, 4)],
    crystallization: [Crystallization.disk(1)],
};

// ==========================
// ASTRO GOLD POWDER — jitter + dispersion, then inertia keeps it moving.
const GOLD_ID = "InGold-AGold";
export const astroGoldInLiquidGold: Profile = {
    id: GOLD_ID,
    seedType: ElementType.astroGoldPowder,
    liquidType: ElementType.liquidGold,
    crystalType: ElementType.astroGoldCrystal,
    tickSpeed: () => live(GOLD_ID, "tickSpeed", 50),
    enabled: () => live(GOLD_ID, "enabled", true),
    growEnabled: () => live(GOLD_ID, "growEnabled", false),
    crystallizationEnabled: () => live(GOLD_ID, "crystalEnabled", false),
    ageField: ASTRO_FIELD.AGE,
    // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
    // memDecay integrates it into a real fading velocity; memBounce
    // reflects it off walls/floor so landing seeds rebound upward.
    memField: ASTRO_FIELD.VX,
    memDecay: 0.1,
    memBounce: true,
    growAge: () => 10,
    moves: [
        // Jitter — uniform random draw over the allowed offsets.
        Move.random(80, 10, MASK.SIDE),
        Move.random(80, 10, MASK.VERT),
        // Walls / structure / empty push the seed back in.
        Move.channel({
            ...channelMatch(["empty", "structure"]),
            chance: 100,
            weight: -15,
            mask: MASK.PLUS,
        }),
        // Water is a hard push away.
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.water],
            weight: -1,
            mask: MASK.FULL,
        }),
        // Own kind spreads (diagonal neighbours stay free to settle).
        Move.channel({
            chance: 80,
            matchTypes: [ElementType.astroGoldPowder],
            weight: -1,
            mask: MASK.ALL,
        }),
        Move.channel({
            chance: 50,
            matchTypes: [ElementType.astroGoldPowder],
            weight: .4,
            mask: MASK.OUT,
        }),
        Move.channel({
            chance: 50,
            matchTypes: [ElementType.astroCopperPowder],
            weight: -15,
            mask: MASK.FULL,
        }),
        // Inertia — own last-tick flow vector drives a matching vote gradient
        // (straight-line persistence on top of the jitter).
        Move.inertia({ chance: 1, weight: .1, mode: "full" }),
    ],
    grow: [],
    crystallization: [],
};

// ==========================
// ASTRO COPPER POWDER — jitters, forms diagonal chains, grows into GC alloy.
const COPPER_ID = "InGold-ACopper";
export const astroCopperInLiquidGold: Profile = {
    id: COPPER_ID,
    seedType: ElementType.astroCopperPowder,
    liquidType: ElementType.liquidGold,
    crystalType: ElementType.astroGCalloyPowder,
    tickSpeed: () => live(COPPER_ID, "tickSpeed", 50),
    enabled: () => live(COPPER_ID, "enabled", true),
    growEnabled: () => live(COPPER_ID, "growEnabled", false),
    crystallizationEnabled: () => live(COPPER_ID, "crystalEnabled", false),
    ageField: ASTRO_FIELD.AGE,
    // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
    memField: ASTRO_FIELD.VX,
    memDecay: 0.9,
    memBounce: true,
    growAge: () => 3,
    moves: [
        // Jitter — uniform random draw over the 8 neighbours.
        Move.random(80, 10),
        // Gravity — liquid gold below pulls the seed down.
        Move.channel({
            chance: 1,
            matchTypes: [ElementType.liquidGold],
            weight: -.1,
            mask: MASK.GRAVITY,
        }),
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.water],
            weight: -1,
            mask: MASK.FULL,
        }),
        Move.channel({
            ...channelMatch(["empty", "structure"]),
            chance: 100,
            weight: -10,
            mask: MASK.PLUS,
        }),
        // Lattice — own kind repels orthogonally but attracts diagonally, so
        // copper settles into diagonal chains instead of a solid blob.
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.astroCopperPowder],
            weight: -2,
            mask: MASK.CROSS,
        }),
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.astroCopperPowder],
            weight: 2,
            mask: MASK.PLUS,
        }),
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.astroGoldPowder],
            weight: 2,
        }),
        Move.channel({
            chance: 90,
            matchTypes: [ElementType.astroGCalloyPowder],
            weight: -1,
        }),
        Move.memory({ chance: 20, weight: .5, mask: MASK.FULL }),
        Move.inertia({ chance: 20, weight: .5, mode: "full" }),
    ],
    grow: [
        Grow.ageOnSurround(2, 4, ElementType.astroGoldPowder),
        Grow.eat({
            chance: 1,
            matchTypes: [ElementType.astroGoldPowder],
            replaceType: null,
        }),
    ],
    crystallization: [Crystallization.disk(1)],
};
