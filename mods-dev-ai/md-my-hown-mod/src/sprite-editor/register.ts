
import { api as skApi } from "../packages/mysandkit.ts";
import { LOG } from "../constants.ts";
import { dataUrlToBlob } from "./codec.ts";

export interface RegisterResult {
    ok: boolean;
    
    via?: string;
    error?: string;
}


const blobUrls = new Map<string, string>();


function spritesApi(): any {
    return skApi.sprites.raw();
}

function isLoaded(sprites: any, id: string): boolean {
    try {
        if (typeof sprites.getById !== "function") return true; 
        const s = sprites.getById(id);
        return s !== null && s !== undefined;
    } catch {
        return true;
    }
}

export async function registerDataUrlSprite(
    id: string,
    dataUrl: string,
    options?: Record<string, unknown>,
): Promise<RegisterResult> {
    const sprites = spritesApi();
    if (!sprites || typeof sprites.load !== "function") {
        return { ok: false, error: "api.sprites.load unavailable" };
    }
    const opts = options ?? {};
    let lastErr = "";

    try {
        await sprites.load(id, dataUrl, opts);
        if (isLoaded(sprites, id)) return { ok: true, via: "data-url" };
        lastErr = "load(data URL) resolved but sprite not found";
    } catch (e) {
        lastErr = String((e as Error)?.message ?? e);
    }

    try {
        const prev = blobUrls.get(id);
        const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
        await sprites.load(id, url, opts);
        blobUrls.set(id, url);
        if (prev) URL.revokeObjectURL(prev);
        if (isLoaded(sprites, id)) return { ok: true, via: "blob-url" };
        lastErr = "load(blob URL) resolved but sprite not found";
    } catch (e) {
        lastErr = String((e as Error)?.message ?? e);
    }

    console.warn(`${LOG} sprite-editor: could not register sprite ${id}: ${lastErr}`);
    return { ok: false, error: lastErr };
}
