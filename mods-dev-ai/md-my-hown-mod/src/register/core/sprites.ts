import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerSprites({ config }: RegisterContext): number {
    
    return registerEach(config.sprites, "sprites", (def) => {
        void loadSprite(def.id, def.source, def.path, def.fromMod, def.options ?? {});
    });
}

async function loadSprite(
    id: string,
    source: string | undefined,
    path: string | undefined,
    fromMod: boolean | undefined,
    options: Record<string, unknown>,
): Promise<void> {
    try {
        if (typeof source === "string" && source.startsWith("data:")) {
            const { registerDataUrlSprite } = await import("../../sprite-editor/register.ts");
            await registerDataUrlSprite(id, source, options);
            return;
        }
        if (path && fromMod !== false) {
            await api.sprites.loadFromMod(id, path, options);
            return;
        }
        const src = source ?? path;
        if (src === undefined) {
            console.warn(`${LOG} sprite ${id}: need path or source`);
            return;
        }
        await api.sprites.load(id, src, options);
    } catch (e) {
        console.error(`${LOG} sprites.load failed`, id, e);
    }
}