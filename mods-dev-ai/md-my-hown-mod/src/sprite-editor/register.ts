/**
 * sprite-editor / register — hand a drawn sprite (base64 PNG) to the game.
 *
 * `api.sprites.load(id, path, options?)` is documented for paths, not for
 * data URLs, so this tries, in order:
 *   1. load(id, "data:image/png;base64,…")
 *   2. load(id, blob: URL created from the same bytes)
 * and verifies with `sprites.getById(id)` when that method exists.
 */
import { api as skApi } from "../packages/mysandkit.ts";
import { LOG } from "../constants.ts";
import { dataUrlToBlob } from "./codec.ts";

export interface RegisterResult {
    ok: boolean;
    /** which strategy worked: "data-url" | "blob-url" */
    via?: string;
    error?: string;
}

/** blob URLs we created, so a re-save can release the previous one */
const blobUrls = new Map<string, string>();

/**
 * The engine's `sprites` namespace.
 *
 * `raw()` rather than a wrapped method: this file needs `load`, `getById` and
 * `list` itself and already knows their shapes, so a wrapper per call would add
 * indirection without adding safety. The wrapper still owns the resolution order
 * and the failure containment, which is the part that matters here.
 */
function spritesApi(): any {
    return skApi.sprites.raw();
}

function isLoaded(sprites: any, id: string): boolean {
    try {
        if (typeof sprites.getById !== "function") return true; // cannot verify -> trust load()
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
