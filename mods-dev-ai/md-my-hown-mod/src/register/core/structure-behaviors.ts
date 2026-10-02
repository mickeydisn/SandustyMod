import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerStructureBehaviors({ config }: RegisterContext): number {
    return registerEach(config.structureBehaviors, "structureBehaviors", (def) => {
        try {
            const kind = String(def.kind || "").toLowerCase();
            const payload = def.definition ?? def;
            if (kind === "conveyor") {
                const id = String((payload as { id?: string })?.id ?? def.id);
                const options = (payload as { options?: unknown })?.options ?? payload;
                if (!api.structureBehaviors.registerConveyorType(id, options)) {
                    console.warn(`${LOG} no conveyor registration method`, def.id);
                }
            } else if (kind === "launcher") {
                if (!api.structureBehaviors.registerLauncherType(payload)) {
                    console.warn(`${LOG} no launcher registration method`, def.id);
                }
            } else {
                console.warn(`${LOG} unknown structure behavior kind`, def.kind);
            }
        } catch (e) {
            console.error(`${LOG} structureBehaviors failed`, def.id, e);
        }
    });
}
