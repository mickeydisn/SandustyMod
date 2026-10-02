import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerTerrains({ config }: RegisterContext): number {
    return registerEach(config.terrains, "terrains", (def) => {
        try {
            const id = String(def.id);
            const out: Record<string, unknown> = { ...def, id };
            if (def.name && !def.nameKey) out.nameKey = `terrains|${id}|name`;
            api.terrains.register(out);
        } catch (e) {
            console.error(`${LOG} terrains.register failed`, def.id, e);
        }
    });
}
