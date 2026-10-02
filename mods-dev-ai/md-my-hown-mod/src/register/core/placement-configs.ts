import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { placementConfigPayload, placementConfigProblem } from "../../config/placement.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerPlacementConfigs({ config }: RegisterContext): number {
    return registerEach(config.placementConfigs, "placementConfigs", (def) => {
        const problem = placementConfigProblem(def);
        if (problem) {
            console.error(
                `${LOG} placement config "${def.id}" rejected — ${problem.message}`,
            );
            return;
        }
        try {
            if (!api.structures.registerPlacementConfig(placementConfigPayload(def))) {
                console.warn(`${LOG} no registerPlacementConfig on this build`, def.id);
            }
        } catch (e) {
            console.error(`${LOG} placement config failed`, def.id, e);
        }
    });
}