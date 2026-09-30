/**
 * Fetch a Dicebear icon, classify pixels, paint terrain.
 * Placement follows hiden-word-2 materialize.ts.
 *
 * Icon on black background:
 *   non-black (glyph) → fill (dirt)
 *   1px outline around glyph → outline (moss)
 *   pure black → skip
 */
import "@sandmd/sandkit";
import {
    LOG,
    TERRAIN_ERASE_RING_SIZE,
    TERRAIN_FILL_ALIASES,
    TERRAIN_FILL_ID,
    TERRAIN_ICON_URL,
    terrainRotateForApi,
    TERRAIN_OUTLINE_ALIASES,
    TERRAIN_OUTLINE_ID,
    TERRAIN_ROTATE_MAX,
    TERRAIN_ROTATE_MIN,
    TERRAIN_SEED_MAX,
    TERRAIN_SEED_MIN,
    TERRAIN_ZONE_SIZE,
    STRUCTURE_TO_TERRAIN_SCALE,
    TERRAIN_SPAWN_JITTER,
} from "../constants.ts";

export type PixelKind = "fill" | "outline" | "erase" | "skip";

/** Luma below this = background black (skip). Anything brighter = glyph fill. */
const BG_LUMA_MAX = 40;

/** Distance band of the moss outline — kept at 1 so the original ring is unchanged. */
const OUTLINE_DISTANCE = 1;
/** First distance covered by the erase ring (always just outside the outline). */
const ERASE_DISTANCE_MIN = OUTLINE_DISTANCE + 1;

/** 4-neighbour steps — the axis set the distance BFS walks. */
const NEIGH_DX = [1, -1, 0, 0] as const;
const NEIGH_DY = [0, 0, 1, -1] as const;

/** Minimal shape both `api.terrains` and a `grid.mutate` writer must satisfy. */
interface TerrainWriter {
    createAt?: (x: number, y: number, ref: string) => void;
    replaceAt?: (x: number, y: number, ref: string) => void;
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function luma(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

async function loadRgba(url: string, size: number): Promise<Uint8ClampedArray> {
    console.log(`${LOG} terrain icon fetch URL: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`icon fetch ${res.status} ${url}`);
    const blob = await res.blob();
    console.log(`${LOG} terrain icon blob type=${blob.type} size=${blob.size}`);
    const bmp = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2d context");
    // Ensure black background then draw icon
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bmp, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    bmp.close?.();
    return img.data;
}

export function classifyPixels(data: Uint8ClampedArray, size: number): PixelKind[] {
    // Glyph = not near-black (Dicebear icons are colored, not pure white)
    const isGlyph = new Uint8Array(size * size);
    let glyphCount = 0;
    let sampleMaxL = 0;
    for (let i = 0; i < size * size; i++) {
        const o = i * 4;
        const a = data[o + 3] ?? 255;
        const r = data[o] ?? 0;
        const g = data[o + 1] ?? 0;
        const b = data[o + 2] ?? 0;
        const L = luma(r, g, b);
        if (L > sampleMaxL) sampleMaxL = L;
        // transparent or very dark = background
        if (a < 16 || L <= BG_LUMA_MAX) {
            isGlyph[i] = 0;
        } else {
            isGlyph[i] = 1;
            glyphCount++;
        }
    }

    const out: PixelKind[] = new Array(size * size);
    let fillN = 0;
    let outlineN = 0;
    let eraseN = 0;

    // Manhattan distance from every cell to the nearest glyph pixel, via a
    // multi-source BFS. Four-neighbour steps keep d === 1 identical to the old
    // single-ring check, so the moss outline does not move.
    const eraseMax = ERASE_DISTANCE_MIN + TERRAIN_ERASE_RING_SIZE - 1;
    const UNREACHED = 0xff;
    const dist = new Uint8Array(size * size).fill(UNREACHED);
    const queue = new Int32Array(size * size);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < size * size; i++) {
        if (isGlyph[i]) {
            dist[i] = 0;
            queue[tail++] = i;
        }
    }

    while (head < tail) {
        const i = queue[head++]!;
        const d = dist[i]!;
        // Nothing beyond the erase band is classified, so stop expanding there.
        if (d >= eraseMax) continue;
        const x = i % size;
        const y = (i - x) / size;
        for (let k = 0; k < 4; k++) {
            const nx = x + NEIGH_DX[k]!;
            const ny = y + NEIGH_DY[k]!;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const ni = ny * size + nx;
            if (dist[ni] !== UNREACHED) continue;
            dist[ni] = d + 1;
            queue[tail++] = ni;
        }
    }

    for (let i = 0; i < size * size; i++) {
        const d = dist[i]!;
        if (d === 0) {
            out[i] = "fill";
            fillN++;
        } else if (d <= OUTLINE_DISTANCE) {
            out[i] = "outline";
            outlineN++;
        } else if (d <= eraseMax) {
            out[i] = "erase";
            eraseN++;
        } else {
            // UNREACHED, or beyond the erase band — leave the cell alone.
            out[i] = "skip";
        }
    }
    console.log(
        `${LOG} classify: size=${size} glyph=${glyphCount} fill=${fillN} outline=${outlineN} erase=${eraseN} maxLuma=${sampleMaxL.toFixed(1)} bgMax=${BG_LUMA_MAX} eraseD=${ERASE_DISTANCE_MIN}..${eraseMax}`,
    );
    return out;
}

export async function fetchAndClassifyIcon(): Promise<{
    kinds: PixelKind[];
    url: string;
    seed: number;
    rotate: number;
}> {
    const seed = randInt(TERRAIN_SEED_MIN, TERRAIN_SEED_MAX);
    const rotate = randInt(TERRAIN_ROTATE_MIN, TERRAIN_ROTATE_MAX);
    const rotateApi = terrainRotateForApi(rotate);
    const url = TERRAIN_ICON_URL(seed, rotate);
    console.log(`${LOG} terrain icon URL: ${url} (seed=${seed} rotate=${rotate} → api=${rotateApi})`);
    const data = await loadRgba(url, TERRAIN_ZONE_SIZE);
    const kinds = classifyPixels(data, TERRAIN_ZONE_SIZE);
    return { kinds, url, seed, rotate };
}

/**
 * Pick the terrain ref to hand to `terrains.createAt` / `replaceAt`.
 *
 * There is no id→type lookup on `api.terrains` (the real surface only has
 * `getIdByType`, which is the other direction), but `createAt` accepts a
 * string and resolves it through `world.getCellTypeByName`, so the alias
 * string is passed straight through.
 */
function resolveTerrainRef(aliases: readonly string[]): string | null {
    return aliases[0] ?? null;
}

function canPaintAt(x: number, y: number): boolean {
    const api = sandkit.api;
    try {
        if (api.structures.getAtCell?.(x, y)) return false;
        if (api.structures.hasBuiltAtCell?.(x, y)) return false;
    } catch { /* best-effort */ }
    try {
        if (typeof api.authorization?.canBuildAtCell === "function") {
            if (!api.authorization.canBuildAtCell(x, y)) return false;
        }
    } catch { /* best-effort */ }
    return true;
}

export function isZoneFree(ox: number, oy: number, size: number): boolean {
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            if (!canPaintAt(ox + dx, oy + dy)) return false;
        }
    }
    return true;
}

export function findFreeZone(
    preferNear: { x: number; y: number } | null,
    size: number,
    attempts = 120,
): { x: number; y: number } | null {
    const api = sandkit.api;
    // Metrics often only expose cellSize — do NOT default to 512 (that breaks near search).
    let w = 0;
    let h = 0;
    try {
        const m = (api.rendering?.getGridMetrics?.() ?? api.config?.getLegacy?.() ?? {}) as Record<string, unknown>;
        w = Number(m.worldWidthCells ?? m.widthCells ?? m.mapWidth ?? m.worldWidth ?? 0) || 0;
        h = Number(m.worldHeightCells ?? m.heightCells ?? m.mapHeight ?? m.worldHeight ?? 0) || 0;
        // Some builds store size under config
        if (!w || !h) {
            const cfg = api.config?.get?.() ?? {};
            w = w || Number(cfg.worldWidth ?? cfg.mapWidth ?? 0) || 0;
            h = h || Number(cfg.worldHeight ?? cfg.mapHeight ?? 0) || 0;
        }
        console.log(
            `${LOG} zone search world=${w || "unbounded"}x${h || "unbounded"} metrics keys=${Object.keys(m).slice(0, 12).join(",")}`,
        );
    } catch { /* unbounded */ }

    // Soft bounds only when we know map size; otherwise allow any positive cell
    const margin = 2;
    const hasBounds = w > size && h > size;
    const maxX = hasBounds ? w - size - margin : Number.MAX_SAFE_INTEGER;
    const maxY = hasBounds ? h - size - margin : Number.MAX_SAFE_INTEGER;
    const minX = margin;
    const minY = margin;

    // Anchor = collector footprint origin (structure.x/y are cell coords, same as terrain cells)
    if (preferNear) {
        console.log(
            `${LOG} zone search near structure cell=(${preferNear.x},${preferNear.y}) size=${size}`,
        );
        // Expanding rings: try origin first, then ±step
        const maxRing = Math.max(size * 3, 80);
        for (let ring = 0; ring <= maxRing; ring += Math.max(4, Math.floor(size / 4))) {
            for (let dy = -ring; dy <= ring; dy += Math.max(1, Math.floor(size / 8))) {
                for (let dx = -ring; dx <= ring; dx += Math.max(1, Math.floor(size / 8))) {
                    if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                    const ox = preferNear.x + dx;
                    const oy = preferNear.y + dy;
                    if (ox < minX || oy < minY || ox > maxX || oy > maxY) continue;
                    if (isZoneFree(ox, oy, size)) {
                        console.log(
                            `${LOG} zone found @ cell (${ox},${oy}) ring=${ring} (structure was ${preferNear.x},${preferNear.y})`,
                        );
                        return { x: ox, y: oy };
                    }
                }
            }
        }
    }

    // Random fallback only if we have real bounds (otherwise stay near structure)
    if (hasBounds) {
        for (let i = 0; i < attempts; i++) {
            const ox = randInt(minX, Math.max(minX, maxX));
            const oy = randInt(minY, Math.max(minY, maxY));
            if (isZoneFree(ox, oy, size)) {
                console.log(`${LOG} zone found (random) @ cell (${ox},${oy})`);
                return { x: ox, y: oy };
            }
        }
    }
    return null;
}

/**
 * Write one terrain cell.
 *
 * The real `api.terrains` surface is `createAt` / `replaceAt` / `removeAt` —
 * there is no `createAtCell` / `replaceAtCell`, so the previous names here
 * silently matched nothing and no terrain was ever placed.
 */
function placeOne(
    terrains: TerrainWriter | null | undefined,
    apiTerrains: TerrainWriter | null | undefined,
    x: number,
    y: number,
    ref: string,
): boolean {
    let wrote = false;
    let lastErr: unknown = null;
    for (const t of [terrains, apiTerrains]) {
        if (!t) continue;
        try {
            if (typeof t.createAt === "function") {
                t.createAt(x, y, ref);
                wrote = true;
            }
        } catch (e) {
            lastErr = e;
        }
        try {
            if (typeof t.replaceAt === "function") {
                t.replaceAt(x, y, ref);
                wrote = true;
            }
        } catch (e) {
            lastErr = e;
        }
    }
    if (!wrote && lastErr) {
        // only spam once per stamp via console on first failures (caller logs)
        (placeOne as { _errLogged?: boolean })._errLogged ??= false;
        if (!(placeOne as { _errLogged?: boolean })._errLogged) {
            console.warn(`${LOG} placeOne failed @${x},${y} ref=${String(ref)}`, lastErr);
            (placeOne as { _errLogged?: boolean })._errLogged = true;
        }
    }
    return wrote;
}

/** Remove whatever element occupies a cell. */
function clearElement(x: number, y: number): void {
    const api = sandkit.api;
    try {
        if (typeof api.elements?.removeAt === "function") {
            // The erase ring must not pay out collectors for what it deletes.
            api.elements.removeAt(x, y, { skipCollectorCheck: true });
            return;
        }
    } catch { /* best-effort */ }
    try {
        api.elements?.removeAtDeferred?.(x, y);
    } catch { /* best-effort */ }
}

/**
 * Wipe a cell to Empty: element first (a terrain write would otherwise orphan
 * whatever element is sitting in the cell), then the terrain.
 */
function eraseCell(x: number, y: number): boolean {
    const api = sandkit.api;
    let touched = false;
    try {
        if (api.terrains?.isPosTerrain?.(x, y)) {
            api.terrains.removeAt(x, y, { skipShadow: true });
            touched = true;
        }
    } catch { /* best-effort */ }
    clearElement(x, y);
    return touched;
}

export function paintTerrainFromKinds(
    ox: number,
    oy: number,
    kinds: PixelKind[],
    size: number,
): { fill: number; outline: number; erase: number } {
    const api = sandkit.api;
    const fillRef = resolveTerrainRef(TERRAIN_FILL_ALIASES);
    const outlineRef = resolveTerrainRef(TERRAIN_OUTLINE_ALIASES);

    console.log(
        `${LOG} terrain refs fill=${String(fillRef)} (${TERRAIN_FILL_ID}) outline=${String(outlineRef)} (${TERRAIN_OUTLINE_ID})`,
    );

    const toPlace: { x: number; y: number; ref: string; kind: "fill" | "outline" }[] = [];
    const toErase: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const k = kinds[y * size + x];
            if (k === "fill" && fillRef !== null) {
                toPlace.push({ x: ox + x, y: oy + y, ref: fillRef, kind: "fill" });
            } else if (k === "outline" && outlineRef !== null) {
                toPlace.push({ x: ox + x, y: oy + y, ref: outlineRef, kind: "outline" });
            } else if (k === "erase") {
                toErase.push({ x: ox + x, y: oy + y });
            }
        }
    }
    console.log(
        `${LOG} terrain toPlace=${toPlace.length} toErase=${toErase.length}`,
    );
    (placeOne as { _errLogged?: boolean })._errLogged = false;

    for (const c of toPlace) {
        clearElement(c.x, c.y);
    }

    // The erase ring goes first and runs outside the batched terrain writer:
    // it is a removal, not a write, and the writer only carries create/replace.
    let erase = 0;
    for (const c of toErase) {
        if (eraseCell(c.x, c.y)) erase++;
    }

    let fill = 0;
    let outline = 0;

    const apply = (terrains: Parameters<typeof placeOne>[0]) => {
        let logged = 0;
        for (const c of toPlace) {
            if (placeOne(terrains, api.terrains, c.x, c.y, c.ref)) {
                if (c.kind === "fill") fill++;
                else outline++;
                if (logged < 3) {
                    console.log(`${LOG} terrain write cell=(${c.x},${c.y}) kind=${c.kind} ref=${String(c.ref)}`);
                    logged++;
                }
            }
        }
    };

    try {
        if (typeof api.grid?.mutate === "function") {
            api.grid.mutate((writer: { terrains?: Parameters<typeof placeOne>[0] }) => {
                apply(writer?.terrains ?? api.terrains);
            });
        } else {
            apply(api.terrains);
        }
    } catch (err) {
        console.warn(`${LOG} grid.mutate failed, fallback`, err);
        apply(api.terrains);
    }

    return { fill, outline, erase };
}

export async function runTerrainStamp(near: {
    x: number;
    y: number;
}): Promise<
    | { ox: number; oy: number; fill: number; outline: number; erase: number; url: string }
    | null
> {
    const { kinds, url, seed, rotate } = await fetchAndClassifyIcon();
    console.log(`${LOG} terrain stamp using URL: ${url} (seed=${seed} rotate=${rotate})`);

    // structure.x/y are already terrain/sim cell coords (scale=1)
    const baseX = near.x * STRUCTURE_TO_TERRAIN_SCALE;
    const baseY = near.y * STRUCTURE_TO_TERRAIN_SCALE;
    const jx = randInt(-TERRAIN_SPAWN_JITTER, TERRAIN_SPAWN_JITTER);
    const jy = randInt(-TERRAIN_SPAWN_JITTER, TERRAIN_SPAWN_JITTER);
    const nearTerrain = { x: baseX + jx, y: baseY + jy };
    console.log(
        `${LOG} structure cell=(${near.x},${near.y}) + jitter=(${jx},${jy}) → search near=(${nearTerrain.x},${nearTerrain.y})`,
    );

    const zone = findFreeZone(nearTerrain, TERRAIN_ZONE_SIZE);
    if (!zone) {
        console.warn(`${LOG} terrain: no free ${TERRAIN_ZONE_SIZE}×${TERRAIN_ZONE_SIZE} zone`);
        return null;
    }
    const counts = paintTerrainFromKinds(zone.x, zone.y, kinds, TERRAIN_ZONE_SIZE);
    console.log(
        `${LOG} terrain stamp @(${zone.x},${zone.y}) fill=${counts.fill} outline=${counts.outline} erase=${counts.erase} url=${url}`,
    );
    return { ox: zone.x, oy: zone.y, ...counts, url };
}
