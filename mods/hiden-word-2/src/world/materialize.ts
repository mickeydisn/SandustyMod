/** Place live terrain from the hidden matrix (Manifest tools). */

import { EXPLORE_BORDER_PX, MATERIALIZE_MAP, TERRAIN } from "./constants.ts";
import { runtime } from "./state.ts";
import { ensureTags, isTagsEnabled, TAG, tagAt, touchesMaterialised } from "./tags.ts";

declare const sandkit: { api: any };

const rawApi = (): any => {
    try {
        return (sandkit as any).api;
    } catch {
        return null;
    }
};

const typeCache = new Map<string, string | number | null>();
const ALIASES: Record<string, string[]> = {
    stone: ["stone", "Stone", "rock", "Rock"],
    dirt: ["dirt", "Dirt", "soil", "Soil"],
    moss: ["moss", "Moss"],
    grass: ["grass", "Grass"],
    redsoil: ["redsoil", "Redsoil", "redsand", "Redsand"],
    ice: ["ice", "Ice"],
    water: ["water", "Water"],
    lava: ["lava", "Lava"],
    sporesoil: ["sporesoil", "SporeSoil", "sporeSoil"],
};

function resolveRef(id: string): string | number | null {
    if (typeCache.has(id)) return typeCache.get(id)!;
    const a = rawApi();
    const candidates = ALIASES[id] ?? [id];
    let found: string | number | null = null;
    for (const c of candidates) {
        try {
            const t = a?.terrains?.getTypeById?.(c);
            if (typeof t === "number" && isFinite(t)) {
                found = t;
                break;
            }
        } catch { /* */ }
    }
    if (found === null) found = candidates[0] ?? id;
    typeCache.set(id, found);
    return found;
}

function isLiveEmpty(x: number, y: number): boolean {
    const a = rawApi();
    try {
        if (typeof a?.grid?.isCellEmptyAtCell === "function") {
            return a.grid.isCellEmptyAtCell(x, y) === true;
        }
    } catch { /* */ }
    return true;
}

function spawnMaterializeLight(cellX: number, cellY: number, radius: number): void {
    const a = rawApi();
    try {
        const lights = a?.lights?.temporary;
        if (typeof lights?.createAtWorld !== "function") return;
        let cellSize = 16;
        try {
            cellSize = a.rendering?.getGridMetrics?.()?.cellSize ?? cellSize;
        } catch { /* */ }
        const worldX = (cellX + 0.5) * cellSize;
        const worldY = (cellY + 0.5) * cellSize;
        const size = Math.max(1, Math.round(Math.min(12, radius * 0.75)));
        lights.createAtWorld(worldX, worldY, {
            brightness: 1.2,
            durationMs: 150,
            size: 150,
            color: [1, 1, 0, 1],
        });
    } catch { /* light optional */ }
    try {
        const lights = a?.lights?.persistent;
        if (typeof lights?.fadeAtWorld !== "function") return;
        const cellSize = 16;
        const worldX = (cellX + 0.5) * cellSize;
        const worldY = (cellY + 0.5) * cellSize;
        lights.fadeAtWorld(worldX, worldY, 150);
    } catch { /* light optional */ }
}

function placeOne(
    terrains: any,
    apiTerrains: any,
    x: number,
    y: number,
    ref: string | number,
): boolean {
    let wrote = false;
    for (const t of [terrains, apiTerrains]) {
        if (!t) continue;
        try {
            t.createAtCell?.(x, y, ref);
            wrote = true;
        } catch { /* */ }
        try {
            t.replaceAtCell?.(x, y, ref);
            wrote = true;
        } catch { /* */ }
        try {
            t.damageAtCell?.(x, y, 0);
            wrote = true;
        } catch { /* */ }
    }
    return wrote;
}

function setTagUp(i: number, value: number, tags: Uint8Array): boolean {
    if (tags[i]! >= value) return false;
    tags[i] = value;
    return true;
}

export type MaterializeOpts = {
    skipMaterialised?: boolean;
    requireMaterialisedContact?: boolean;
};

/**
 * World Manifest:
 *  - requires Materialised contact (unless infinite)
 *  - brush (r+0): live empty + not already Materialised → Materialised tag + place solid if any
 *  - border (r+2): live empty → Explored tag
 */
export function materializeBrush(
    cx: number,
    cy: number,
    radius: number,
    opts: MaterializeOpts = {},
): { painted: number; skipped: number; blocked: boolean; taggedMat: number; taggedExp: number } {
    const skipMat = opts.skipMaterialised !== false;
    const needContact = opts.requireMaterialisedContact !== false;

    const data = runtime.data;
    if (!data || runtime.width <= 0) {
        return { painted: 0, skipped: 0, blocked: false, taggedMat: 0, taggedExp: 0 };
    }

    if (isTagsEnabled() && needContact && !touchesMaterialised(cx, cy, radius)) {
        return { painted: 0, skipped: 0, blocked: true, taggedMat: 0, taggedExp: 0 };
    }

    if (isTagsEnabled()) ensureTags();
    const tags = runtime.tags;
    const a = rawApi();
    const w = runtime.width;
    const h = runtime.height;
    const r = Math.max(0, radius | 0);
    const r2 = r * r;
    const border = EXPLORE_BORDER_PX;
    const rBorder = r + border;
    const rBorder2 = rBorder * rBorder;

    let painted = 0;
    let skipped = 0;
    let taggedMat = 0;
    let taggedExp = 0;

    type Cell = { x: number; y: number; ref: string | number | null };
    const toPlace: Cell[] = [];

    // Brush r+0: materialise + Materialised tag
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;

            if (skipMat && isTagsEnabled() && tagAt(x, y) === TAG.MATERIALISED) {
                skipped++;
                continue;
            }
            if (!isLiveEmpty(x, y)) {
                skipped++;
                continue;
            }

            // Tag Materialised for empty cells in brush (any hidden terrain)
            if (tags) {
                const i = y * w + x;
                if (setTagUp(i, TAG.MATERIALISED, tags)) taggedMat++;
            }

            const code = data[y * w + x]!;
            if (code === TERRAIN.TUNNEL || code === TERRAIN.SKY) continue;
            const mapId = MATERIALIZE_MAP[code];
            if (!mapId) continue;
            toPlace.push({ x, y, ref: resolveRef(mapId) });
        }
    }

    // Border ring: Explored only (empty live cells, not already Materialised)
    if (tags) {
        for (let dy = -rBorder; dy <= rBorder; dy++) {
            for (let dx = -rBorder; dx <= rBorder; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > rBorder2 || d2 <= r2) continue; // only the ring outside brush
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || y < 0 || x >= w || y >= h) continue;
                if (!isLiveEmpty(x, y)) continue;
                const i = y * w + x;
                if (tags[i] === TAG.MATERIALISED) continue;
                if (setTagUp(i, TAG.EXPLORED, tags)) taggedExp++;
            }
        }
    }

    const apply = (terrains: any) => {
        for (const c of toPlace) {
            if (c.ref === null) continue;
            if (placeOne(terrains, a?.terrains, c.x, c.y, c.ref)) painted++;
            else skipped++;
        }
    };

    try {
        if (typeof a?.grid?.mutate === "function") {
            a.grid.mutate((writer: any) => {
                apply(writer?.terrains ?? a.terrains);
            });
        } else {
            apply(a?.terrains);
        }
    } catch {
        apply(a?.terrains);
    }

    if (tags) runtime.explored = tags;

    if (painted > 0 || taggedMat > 0) {
        spawnMaterializeLight(cx, cy, r);
    }

    return { painted, skipped, blocked: false, taggedMat, taggedExp };
}
