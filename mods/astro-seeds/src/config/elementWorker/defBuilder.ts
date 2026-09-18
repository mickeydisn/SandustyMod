import { Move } from "@sandmd/element-profiles/worker";
import { ASTRO_FIELD } from "../elementShared/ids.ts";
import { live } from "./live.ts";

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
            Move.side(() => live(ID, "moveSide", 15)),
            Move.down(() => live(ID, "moveDown", 20)),
            Move.up(() => live(ID, "moveUp", 20)),
        ],
    }
);
