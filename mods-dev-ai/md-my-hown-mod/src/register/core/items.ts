
import type { ModConfig } from "../../constants.ts";
import { configStore } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";
import { mayRegister, registered } from "../registry.ts";


export function registerItems(cfg?: ModConfig): number {
    const config = cfg ?? configStore.load();
    let n = 0;
    for (const it of config.items ?? []) {
        if (!it?.id) continue;
        if (registered.items.has(it.id)) continue;
        
        
        
        if (!mayRegister("items", it.id)) continue;
        api.items.register(it);
        registered.items.add(it.id);
        n++;
    }
    return n;
}
