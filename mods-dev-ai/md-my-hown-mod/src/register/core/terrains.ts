
import type { ModConfig } from "../../constants.ts";
import { configStore } from "../../config/store.ts";
import { registerTerrain } from "../../packages/registrations.ts";
import { mayRegister, registered } from "../registry.ts";


export function registerTerrains(cfg?: ModConfig): number {
    const config = cfg ?? configStore.load();
    let n = 0;
    for (const t of config.terrains ?? []) {
        if (!t?.id) continue;
        if (registered.terrains.has(t.id)) continue;
        if (!mayRegister("terrains", t.id)) continue;
        registerTerrain(t);
        registered.terrains.add(t.id);
        n++;
    }
    return n;
}
