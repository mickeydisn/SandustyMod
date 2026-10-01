/**
 * sprite-editor / store — persistence.
 *
 * Drawn sprites are ordinary entries of the mod's existing `sprites` category
 * (config.sprites), so they are saved in the same JSON document in game
 * storage, are exported/imported by the JSON tab, and are registered by
 * applyConfig() at boot with zero extra wiring:
 *
 *   {
 *     "id": "md-my-hown-mod:crate",
 *     "kind": "drawn",
 *     "source": "data:image/png;base64,iVBORw0KGgo…",   // <- valid JSON string
 *     "fromMod": false,
 *     "width": 32, "height": 16, "frameWidth": 16, "frames": 2,
 *     "updatedAt": 1767225600000
 *   }
 */
import { MOD_ID, type SpriteConfig } from "../constants.ts";
import { addOrUpdateSprite, loadConfig, removeSprite } from "../config/store.ts";
import { docToDataUrl, isPngDataUrl } from "./codec.ts";
import { CELL, type EditSession, frameCount } from "./engine.ts";
import { registerDataUrlSprite } from "./register.ts";

export type DrawnSprite = SpriteConfig & {
    kind: "drawn";
    source: string;
    fromMod: false;
    width: number;
    height: number;
    frameWidth: number;
    frames: number;
    updatedAt: number;
};

export function isDrawn(e: SpriteConfig | undefined | null): e is DrawnSprite {
    return !!e && (e as any).kind === "drawn" && isPngDataUrl((e as any).source);
}

export function listSprites(): SpriteConfig[] {
    return loadConfig().sprites ?? [];
}

/** Sprites created with the editor. */
export function listDrawn(): DrawnSprite[] {
    return listSprites().filter(isDrawn);
}

/** Existing file-based assets (`path` in the mod folder) — the "asset collection". */
export function listFileSprites(): SpriteConfig[] {
    return listSprites().filter((s) => !isDrawn(s) && (s.path || s.source));
}

export function getSprite(id: string): SpriteConfig | undefined {
    return listSprites().find((s) => s.id === id);
}

/**
 * "crate" -> "md-my-hown-mod:crate". Returns null when the name is unusable.
 * Allowed: letters, digits, `_ - .` (and one explicit `prefix:` if given).
 */
export function normalizeSpriteId(raw: string): string | null {
    const s = (raw ?? "").trim().replace(/\s+/g, "-");
    if (!s) return null;
    const full = s.includes(":") ? s : `${MOD_ID}:${s}`;
    return /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(full) ? full : null;
}

/** Suggest an id that does not exist yet ("crate", "crate-2", …). */
export function uniqueSpriteId(base: string): string {
    const root = normalizeSpriteId(base) ?? `${MOD_ID}:sprite`;
    const taken = new Set(listSprites().map((s) => s.id));
    if (!taken.has(root)) return root;
    for (let i = 2; i < 10000; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
    return `${root}-${Date.now()}`;
}

/** Build the JSON entry for a session (encodes the PNG). */
export function entryFromSession(s: EditSession, prev?: SpriteConfig): DrawnSprite {
    const { path: _path, ...keep } = (prev ?? {}) as SpriteConfig;
    return {
        ...keep,
        id: s.id,
        kind: "drawn",
        source: docToDataUrl(s.doc),
        fromMod: false,
        width: s.doc.width,
        height: s.doc.height,
        frameWidth: CELL,
        frames: frameCount(s.doc),
        updatedAt: Date.now(),
        ...(prev && !isDrawn(prev) && prev.path ? { replacedPath: prev.path } : {}),
    };
}

export interface SaveResult {
    ok: boolean;
    error?: string;
    entry?: DrawnSprite;
    /** did the game accept the sprite right now? */
    registered?: boolean;
    via?: string;
}

/** Validate target id, write to storage and (re)register in the game. */
export async function saveSession(s: EditSession): Promise<SaveResult> {
    const id = normalizeSpriteId(s.id);
    if (!id) return { ok: false, error: "Invalid id (use letters, digits, - _ .)" };
    s.id = id;

    const existing = getSprite(id);
    if (existing && s.isNew && s.replaces !== id) {
        return { ok: false, error: `Id already used: ${id} — choose another one` };
    }

    const entry = entryFromSession(s, existing);
    // Guarantee a valid JSON round-trip before touching storage.
    try {
        JSON.parse(JSON.stringify(entry));
    } catch (e) {
        return { ok: false, error: "Sprite is not JSON-serialisable: " + String(e) };
    }
    addOrUpdateSprite(entry);

    s.isNew = false;
    s.replaces = undefined;
    s.dirty = false;

    const reg = await registerDataUrlSprite(
        id,
        entry.source,
        entry.options as Record<string, unknown> | undefined,
    );
    return { ok: true, entry, registered: reg.ok, via: reg.via };
}

export function deleteSprite(id: string): void {
    removeSprite(id);
}

/** Sprite ids for form pickers (drawn first, then file-based). */
export function listSpriteOptions(): Array<{ value: string; label: string }> {
    const drawn = listDrawn().map((s) => ({ value: s.id, label: `✏ ${s.id}` }));
    const files = listFileSprites().map((s) => ({ value: s.id, label: s.id }));
    return [...drawn, ...files];
}
