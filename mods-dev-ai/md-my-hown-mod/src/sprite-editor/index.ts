/**
 * sprite-editor — public surface.
 *
 *   import { getDrawTab } from "../sprite-editor/index.ts";      // panel tab
 *   import { listSpriteOptions } from "../sprite-editor/index.ts"; // pickers
 */
export { getCurrentSession, getDrawTab, setCurrentSession } from "./tab.ts";
export { getSpriteEditor } from "./editor.ts";
export {
    deleteSprite,
    type DrawnSprite,
    entryFromSession,
    getSprite,
    isDrawn,
    listDrawn,
    listFileSprites,
    listSpriteOptions,
    normalizeSpriteId,
    saveSession,
    uniqueSpriteId,
} from "./store.ts";
export { registerDataUrlSprite } from "./register.ts";
export { dataUrlToBlob, docToDataUrl, fileToDoc, isPngDataUrl, loadUrlToDoc } from "./codec.ts";
export * as engine from "./engine.ts";
