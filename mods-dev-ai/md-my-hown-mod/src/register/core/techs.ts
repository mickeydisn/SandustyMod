import { LOG, type TechConfig } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { engineTechOf, techUnlockStructureIds } from "../../ui/tech-link.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

function registerTech(def: TechConfig): void {
    try {
        const id = String(def.id);
        const { parentId, preferredPosition, ...body } = def as Record<string, unknown>;
        if (!api.tech.registerDefinition(id, body)) {
            console.warn(`${LOG} tech ${def.id}: no registerDefinition on this build`);
            return;
        }
        if (parentId != null) {
            api.tech.registerNode(id, body, { parentId, preferredPosition });
        }
    } catch (e) {
        console.error(`${LOG} tech.register failed`, def.id, e);
    }
}

export function registerTechs({ config }: RegisterContext): number {
    const n = registerEach(config.techs, "techs", (t) => {
        const ids = techUnlockStructureIds(t.id, config);
        registerTech(ids.length ? { ...t, unlocks: { ...(t.unlocks ?? {}), structures: ids } } : t);
    });
    
    
    return n + registerEach(config.unlockNodes, "techs", (node) => {
        if (node.kind !== "tech" || node.techId) return false;
        const tech = engineTechOf(node, config);
        if (!tech) return false;
        registerTech(tech);
    });
}