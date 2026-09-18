import { Move } from "@sandmd/element-profiles/worker";
import { ASTRO_FIELD } from "../elementShared/ids.ts";
import { live } from "./live.ts";
import { MASK } from "./mask.ts";
import { ElementType } from "../elementShared/resolve.ts";

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
            Move.side(() => live(ID, "moveSide", 0)),
            Move.down(() => live(ID, "moveDown", 0)),
            Move.up(() => live(ID, "moveUp", 0)),
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
                chance: () => live(ID, "aGold_Rate", 0),
                weight: () => live(ID, "aGold_Weight", 0), // () => live(ID, "weighASeed", 15),
                matchTypes: [ElementType.astroCopperPowder],
                mask: MASK.FULL,
            }),
        ],
    }
);
