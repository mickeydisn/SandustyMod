import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const projectiles = {
    register(def: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.projectiles;
            if (typeof ns?.register !== "function") return false;
            ns.register(def);
            return true;
        } catch (e) {
            console.error(`${LOG} projectiles.register failed`, def.id, e);
            return false;
        }
    },
    createBlueprintFromId(id: string): unknown {
        try {
            return g()?.api?.projectiles?.createBlueprintFromId?.(id);
        } catch (e) {
            console.warn(`${LOG} projectiles.createBlueprintFromId failed`, id, e);
            return undefined;
        }
    },

    spawnAtWorld(x: number, y: number, angle: number, blueprint: unknown): void {
        try {
            g()?.api?.projectiles?.spawnAtWorld?.(x, y, angle, blueprint);
        } catch (e) {
            console.warn(`${LOG} projectiles.spawnAtWorld failed`, x, y, e);
        }
    },
};
