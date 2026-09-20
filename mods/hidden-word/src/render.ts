/**
 * Hidden World — ghost view rendering.
 *
 * The hidden matrix is pre-rendered once into a 1px-per-cell offscreen canvas;
 * every `frame:render` the visible sub-rectangle is blitted over the normal
 * map, anchored to world coordinates through `api.rendering`. The layer is
 * shown while the Ghost Lens item is the player's selected item, with the
 * opacity from the `ghostAlphaPercent` config.
 *
 * The hidden matrix is a map of TERRAINS, not an image: `CODE_TERRAIN` binds
 * each code to a real game terrain — rock reads as `stone`, cave as `dirt` —
 * while sky and tunnels stay transparent, so the carved corridors show as
 * holes in the rock. Colours are the **terrain metadata colours** documented in
 * `doc/docs_tech/COLOR-CATALOG.md` § "Terrain metadata colors": the engine's
 * own definition wins (`metaColor` → `colorHSL` → `color`) and those catalog
 * values are the fallback.
 */

import {
    CODE_LABELS,
    CODE_TERRAIN,
    FALLBACK_CODE_COLORS,
    LOG,
    TERRAIN,
    TERRAIN_META_NAMES,
    TERRAIN_NAME_KEY_PREFIX,
} from "./constants.ts";
import { api } from "./api.ts";
import { isLensSelected } from "./lens.ts";
import { runtime } from "./state.ts";
import { generateHiddenTerrain } from "./terrain.ts";
import type { Rgba, TerrainDefinitionLike } from "./types.ts";

/** Packed 0xRRGGBB (the engine's `metaColor` format) → opaque RGBA. */
function packedToRgba(packed: number): Rgba {
    return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255];
}

/** `"#rrggbb"` → opaque RGBA, or null when it is not a colour string. */
function hexToRgba(value: string): Rgba | null {
    const hex = value.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        255,
    ];
}

/** Normalize an `[r,g,b(,a)]` sample to RGBA 0–255 (variants may be 0–1). */
function normalizeRgb(rgb: number[]): Rgba {
    const [r, g, b] = rgb;
    const scale = Math.max(r, g, b) <= 1 ? 255 : 1;
    return [
        Math.round(r * scale),
        Math.round(g * scale),
        Math.round(b * scale),
        255,
    ];
}

/** HSL `[h(°), s(%), l(%)]` → opaque RGBA (the catalog's `colorHSL` column). */
function hslToRgba(hsl: number[]): Rgba | null {
    if (hsl.length < 3) return null;
    const h = (((hsl[0]! % 360) + 360) % 360);
    const s = Math.min(100, Math.max(0, hsl[1]!)) / 100;
    const l = Math.min(100, Math.max(0, hsl[2]!)) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let rgb: [number, number, number];
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return [
        Math.round((rgb[0] + m) * 255),
        Math.round((rgb[1] + m) * 255),
        Math.round((rgb[2] + m) * 255),
        255,
    ];
}

/** Where a colour came from — surfaced in the log line and the legend tooltip. */
type ColorSource = "engine metaColor" | "engine colorHSL" | "engine color" | "catalog fallback";

/**
 * The **terrain metadata colour** out of an engine terrain definition.
 * `metaColor` (packed 0xRRGGBB — the catalog's hex column) wins; then the
 * renderer's explicit `colorHSL`, then a plain `color` field.
 */
function rgbFromTerrainDef(
    def: TerrainDefinitionLike | null | undefined,
): { rgba: Rgba; source: ColorSource } | null {
    if (!def || typeof def !== "object") return null;

    const meta = def.metaColor;
    if (typeof meta === "number" && Number.isFinite(meta)) {
        return { rgba: packedToRgba(meta), source: "engine metaColor" };
    }
    if (typeof meta === "string") {
        const fromHex = hexToRgba(meta);
        if (fromHex) return { rgba: fromHex, source: "engine metaColor" };
    }

    const hsl = def.colorHSL;
    if (Array.isArray(hsl)) {
        const fromHsl = hslToRgba(hsl as number[]);
        if (fromHsl) return { rgba: fromHsl, source: "engine colorHSL" };
    }

    const color = def.color;
    if (typeof color === "number" && Number.isFinite(color)) {
        return { rgba: packedToRgba(color), source: "engine color" };
    }
    if (Array.isArray(color)) return { rgba: normalizeRgb(color as number[]), source: "engine color" };
    return null;
}

/** Matrix codes in paint order (sky first, then the rock-carved bands). */
const TERRAIN_CODES = [TERRAIN.SKY, TERRAIN.ROCK, TERRAIN.TUNNEL, TERRAIN.CAVE] as const;

/** Internal terrain type for a string id (`api.terrains`, main + worker). */
function terrainTypeFor(id: string): number | null {
    try {
        const type = api.terrains.getTypeById?.(id);
        if (typeof type === "number") return type;
    } catch (err) {
        console.warn(`${LOG} terrain type lookup failed for "${id}"`, err);
    }
    return null;
}

/** The metadata colour of one terrain id, straight from its engine definition. */
function resolveTerrainColor(id: string): { rgba: Rgba; source: ColorSource } | null {
    try {
        const type = terrainTypeFor(id);
        if (type == null) return null;
        return rgbFromTerrainDef(api.terrains.getDefinitionByType?.(type));
    } catch (err) {
        console.warn(`${LOG} terrain color lookup failed for "${id}"`, err);
        return null;
    }
}

/**
 * The engine's localized terrain name (`terrains|stone|name`), falling back to
 * the catalog name when the translation is not resolvable.
 */
function resolveTerrainName(id: string): string | null {
    const key = `${TERRAIN_NAME_KEY_PREFIX}|${id}|name`;
    try {
        const translated = api.i18n.t?.(key);
        if (typeof translated === "string" && translated.length > 0 && translated !== key) {
            return translated;
        }
    } catch {
        /* fall through to the catalog name */
    }
    return TERRAIN_META_NAMES[id] ?? null;
}

/** `#rrggbb` — for the palette log line only. */
function toHex([r, g, b]: Rgba): string {
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resolve the colour of every matrix code. The codes are **terrains**, so the
 * ghost view paints terrain metadata colours — and codes that map to no terrain
 * (sky, tunnels) stay fully transparent.
 */
/** One resolved term of the ghost palette (a terrain, or nothing painted). */
export interface PaletteEntry {
    /** Matrix code (`TERRAIN.*`). */
    code: number;
    /** Terrain id from `CODE_TERRAIN`, or null when the code paints nothing. */
    terrain: string | null;
    /** Short matrix-code name from `CODE_LABELS` (`"rock"`, `"tunnel"`, …). */
    codeLabel: string;
    /** Label for the panel legend, e.g. `"Stone (stone)"`. */
    label: string;
    /** The resolved colour (transparent when nothing is painted). */
    rgba: Rgba;
    hex: string;
    alpha: number;
    /** Where the colour came from — logged and shown in the legend tooltip. */
    source: ColorSource | "transparent";
}

/** Resolve one matrix code into its ghost-palette entry. */
function resolvePaletteEntry(code: number): PaletteEntry {
    const terrain = CODE_TERRAIN[code] ?? null;
    const codeLabel = CODE_LABELS[code] ?? String(code);

    // No terrain → nothing painted: sky and tunnels stay clear, so the carved
    // corridors read as holes in the rock.
    if (!terrain) {
        return {
            code,
            terrain: null,
            codeLabel,
            label: `${codeLabel} — transparent`,
            rgba: [0, 0, 0, 0],
            hex: "#000000",
            alpha: 0,
            source: "transparent",
        };
    }

    const resolved = resolveTerrainColor(terrain);
    const rgba = resolved?.rgba ?? FALLBACK_CODE_COLORS[code] ?? [0, 0, 0, 0];
    return {
        code,
        terrain,
        codeLabel,
        label: `${resolveTerrainName(terrain) ?? terrain} (${terrain})`,
        rgba,
        hex: toHex(rgba),
        alpha: rgba[3],
        source: resolved?.source ?? "catalog fallback",
    };
}

/** Resolved ghost palette — filled on the first cache build / legend render. */
let paletteCache: PaletteEntry[] | null = null;

/**
 * The ghost palette in paint order (sky, rock, tunnel, cave): a swatch + the
 * terrain name per matrix code, for the panel legend.
 */
export function ghostPalette(): PaletteEntry[] {
    if (!paletteCache) paletteCache = TERRAIN_CODES.map(resolvePaletteEntry);
    return paletteCache;
}

/** Build the 1px-per-cell cache canvas from the matrix. Returns null on failure. */
export function buildCache(): HTMLCanvasElement | null {
    if (!runtime.data) return null;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = runtime.width;
        canvas.height = runtime.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // Resolve each matrix code's terrain metadata colour once per build.
        const entries = ghostPalette();
        const table = new Map<number, Rgba>();
        for (const entry of entries) table.set(entry.code, entry.rgba);
        console.log(
            `${LOG} ghost palette ` +
                entries
                    .map(
                        (entry) =>
                            `${entry.codeLabel}=${
                                entry.alpha === 0
                                    ? "transparent"
                                    : `${entry.hex} (${entry.source})`
                            }`,
                    )
                    .join(" "),
        );

        const image = ctx.createImageData(runtime.width, runtime.height);
        for (let i = 0; i < runtime.data.length; i++) {
            const [r, g, b, a] = table.get(runtime.data[i]!)!;
            image.data[i * 4] = r;
            image.data[i * 4 + 1] = g;
            image.data[i * 4 + 2] = b;
            image.data[i * 4 + 3] = a;
        }
        ctx.putImageData(image, 0, 0);
        return canvas;
    } catch (err) {
        console.warn(`${LOG} cache build failed`, err);
        return null;
    }
}

/** Build matrix + cache once per session; failures stop per-frame retries. */
function ensureCache(): void {
    if (runtime.cache || runtime.buildFailed) return;
    try {
        if (!runtime.data) {
            runtime.data = generateHiddenTerrain(
                runtime.seed,
                runtime.width,
                runtime.height,
                runtime.params,
            );
        }
        runtime.cache = buildCache();
    } catch (err) {
        console.warn(`${LOG} terrain build failed`, err);
        runtime.buildFailed = true;
    }
}

/**
 * Force a full rebuild from the current seed + params (the overlay's
 * Refresh). Returns false when the rebuild failed.
 */
export function refreshHiddenWorld(): boolean {
    runtime.data = null;
    runtime.cache = null;
    runtime.buildFailed = false;
    paletteCache = null;
    ensureCache();
    return !runtime.buildFailed;
}

/**
 * Paint the ghost layer (if the lens is selected) aligned to the real map.
 * The visible world rectangle is derived from the overlay viewport and the
 * draw position of the world origin, then blitted from the cache canvas.
 */
export function paintGhostView(): void {
    if (!isLensSelected()) return;
    ensureCache();
    if (!runtime.cache) return;
    try {
        api.rendering.withOverlayContext((ctx) => {
            if (!ctx || !runtime.cache) return;
            const cellSize = api.rendering.getGridMetrics().cellSize;
            const viewport = api.rendering.getOverlayViewportSize?.() ?? {
                width: globalThis.innerWidth,
                height: globalThis.innerHeight,
            };
            const origin = api.rendering.getDrawPositionAtWorld(0, 0);
            const step = api.rendering.getDrawPositionAtWorld(cellSize, cellSize);
            const scale = { x: step.x - origin.x, y: step.y - origin.y };
            if (scale.x <= 0 || scale.y <= 0) return;

            // Visible part of the hidden matrix, in cache pixels (1px = cell).
            const sx = Math.max(0, Math.floor(-origin.x / scale.x));
            const sy = Math.max(0, Math.floor(-origin.y / scale.y));
            const sw = Math.min(runtime.width - sx, Math.ceil(viewport.width / scale.x) + 1);
            const sh = Math.min(runtime.height - sy, Math.ceil(viewport.height / scale.y) + 1);
            if (sw <= 0 || sh <= 0) return;

            ctx.save();
            ctx.globalAlpha = runtime.alpha;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                runtime.cache,
                sx,
                sy,
                sw,
                sh,
                origin.x + sx * scale.x,
                origin.y + sy * scale.y,
                sw * scale.x,
                sh * scale.y,
            );
            ctx.restore();
        });
    } catch (err) {
        console.warn(`${LOG} ghost paint failed`, err);
    }
}
