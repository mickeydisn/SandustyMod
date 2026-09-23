import { Move } from "@sandmd/element-profiles/worker";
import { ASTRO_FIELD } from "../../ids.ts";
import { live } from "./live.ts";
import { MASK } from "./mask.ts";
import { ElementType } from "../elementShared/resolve.ts";
import { channelMatch } from "./keys.ts";

export const buildElementProfie = (ID: string) => (
    {
        id: ID,
        tickSpeed: () => live(ID, "tickSpeed", 50),
        enabled: () => live(ID, "enabled", true),
        growEnabled: () => live(ID, "growEnabled", false),
        crystallizationEnabled: () => live(ID, "crystalEnabled", false),
        ageField: ASTRO_FIELD.AGE,
        growAge: () => 150,
        moves: [
            Move.random(
                () => live(ID, "random_Rate", 0),
                () => live(ID, "random_Weight", 0),
                MASK.FULL,
            ),
            // Gravity — liquid gold below pulls the seed down.
            Move.channel({
                chance: () => live(ID, "gravity_Rate", 0),
                weight: () => live(ID, "gravity_Weight", 0),
                // matchTypes: [ElementType.liquidGold],
                mask: MASK.GRAVITY,
            }),

            // Move.side(() => live(ID, "moveSide", 0)),
            // Move.down(() => live(ID, "moveDown", 0)),
            // Move.up(() => live(ID, "moveUp", 0)),
            // Walls / structure / empty push the seed back in.
            Move.channel({
                ...channelMatch(["empty", "structure"]),
                chance: 100,
                weight: -50,
                mask: MASK.PLUSS,
            }),
            Move.channel({
                chance: () => live(ID, "aSeed_Rate", 0),
                weight: () => live(ID, "aSeed_Weight", 0), // () => live(ID, "weighASeed", 15),
                matchTypes: [ElementType.astroSeed],
                mask: MASK.FULL,
            }),
            Move.channel({
                chance: () => live(ID, "aGold_Rate", 0),
                weight: () => live(ID, "aGold_Weight", 0), // () => live(ID, "weighASeed", 15),
                matchTypes: [ElementType.astroGoldPowder],
                mask: MASK.FULL,
            }),
            Move.channel({
                chance: () => live(ID, "aCopper_Rate", 0),
                weight: () => live(ID, "aCopper_Weight", 0), // () => live(ID, "weighASeed", 15),
                matchTypes: [ElementType.astroCopperPowder],
                mask: MASK.FULL,
            }),
            Move.inertia({
                chance: () => live(ID, "aInertia_Rate", 0),
                weight: () => live(ID, "aInertia_Weight", 0),
                mode: "full",
            }),
        ],
    }
);
