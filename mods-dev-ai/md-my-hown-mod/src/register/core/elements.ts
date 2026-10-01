
import { LOG, type ModConfig } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api, normalizeElementPatch } from "../../packages/mysandkit.ts";
import { isBootWindowOpen, registered } from "../registry.ts";
import { noteElementVisibility } from "./element-picker.ts";

export { closeBootWindow } from "../registry.ts";
export { __resetBootWindowForTests } from "../registry.ts";


export function registerElements(cfg?: ModConfig): number {
    const config = cfg ?? loadConfig();
    let n = 0;
    for (const el of config.elements ?? []) {
        if (!el?.id) continue;
        if (registered.elements.has(el.id)) continue;
        if (!isBootWindowOpen()) continue;
        const res = api.elements.register(el);
        if (res === undefined) continue;
        registered.elements.add(el.id);
        n++;
        const type = res.elementType;
        if (typeof type === "number") api.elements.addElementToDiscoveries(type);
        
        
        
        
        noteElementVisibility(type, el as Record<string, unknown>);
        
        
        
        
        
        
        
        
        const normalised = normalizeElementPatch(el as Record<string, unknown>);
        console.log(
            `${LOG} element ${el.id} type=${type} matterType ` +
                `${JSON.stringify((el as { matterType?: unknown }).matterType)} ` +
                `-> ${JSON.stringify(normalised.matterType)}`,
        );
    }
    return n;
}
