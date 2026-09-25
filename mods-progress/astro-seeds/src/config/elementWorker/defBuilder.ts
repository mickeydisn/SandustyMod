import { Move } from "@sandmd/element-profiles/worker";
import { ASTRO_FIELD } from "../../ids.ts";
import type { ProfileId } from "../profileRuntime.ts";
import { live } from "./live.ts";
import { MASK } from "./mask.ts";
import { ElementType } from "../elementShared/resolve.ts";
import { channelMatch } from "./keys.ts";

const WATER_PROFILE_GROW_AGE = 150;
const WALL_REPULSION_CHANCE = 100;
const WALL_REPULSION_WEIGHT = -50;

export const buildElementProfile = (ID: ProfileId) => (
    {
        id: ID,
        tickSpeed: () => live(ID, "tickSpeed"),
        enabled: () => live(ID, "enabled"),
        growEnabled: () => live(ID, "growEnabled"),
        crystallizationEnabled: () => live(ID, "crystalEnabled"),
        ageField: ASTRO_FIELD.AGE,
        growAge: () => WATER_PROFILE_GROW_AGE,
        moves: [
            Move.random(
                () => live(ID, "random_Rate"),
                () => live(ID, "random_Weight"),
                MASK.FULL,
            ),
            // Gravity — liquid gold below pulls the seed down.
            Move.channel({
                chance: () => live(ID, "gravity_Rate"),
                weight: () => live(ID, "gravity_Weight"),
                // matchTypes: [ElementType.liquidGold],
                mask: MASK.GRAVITY,
            }),

            // Optional profile-specific side/down/up moves can be added here.
            // Walls / structure / empty push the seed back in.
            Move.channel({
                ...channelMatch(["empty", "structure"]),
                chance: WALL_REPULSION_CHANCE,
                weight: WALL_REPULSION_WEIGHT,
                mask: MASK.PLUSS,
            }),
            Move.channel({
                chance: () => live(ID, "aSeed_Rate"),
                weight: () => live(ID, "aSeed_Weight"),
                matchTypes: [ElementType.astroSeed],
                mask: MASK.FULL,
            }),
            Move.channel({
                chance: () => live(ID, "aGold_Rate"),
                weight: () => live(ID, "aGold_Weight"),
                matchTypes: [ElementType.astroGoldPowder],
                mask: MASK.FULL,
            }),
            Move.channel({
                chance: () => live(ID, "aCopper_Rate"),
                weight: () => live(ID, "aCopper_Weight"),
                matchTypes: [ElementType.astroCopperPowder],
                mask: MASK.FULL,
            }),
            Move.inertia({
                chance: () => live(ID, "aInertia_Rate"),
                weight: () => live(ID, "aInertia_Weight"),
                mode: "full",
            }),
        ],
    }
);
