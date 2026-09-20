/**
 * Hidden World — local typing for the parts of the sandkit API this mod uses.
 * The global `sandkit` comes from the `@sandmd/sandkit` type import.
 */

import type { Point, Size } from "@sandmd/shared";

/** Canvas-like 2D drawing context handed out by `rendering.withOverlayContext`. */
export type OverlayContext = {
    save(): void;
    restore(): void;
    globalAlpha: number;
    imageSmoothingEnabled: boolean;
    drawImage(
        image: CanvasImageSource,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
    ): void;
};

/** One RGBA pixel, channels 0–255. */
export type Rgba = [number, number, number, number];

/**
 * The slice of a **terrain** definition this mod reads for colors.
 * Terrain metadata colors are documented in
 * `doc/docs_tech/COLOR-CATALOG.md` § "Terrain metadata colors".
 */
export interface TerrainDefinitionLike {
    /** Terrain id (`"stone"`, `"dirt"`, …). */
    id?: unknown;
    /** Localized name, when the definition carries one inline. */
    name?: unknown;
    /** i18n key for the name (`"terrains|stone|name"`). */
    nameKey?: unknown;
    /** Packed 0xRRGGBB metadata color, or an [r,g,b] array. */
    color?: unknown;
    /** Packed 0xRRGGBB map/inspector color — the terrain's canonical color. */
    metaColor?: unknown;
    /** Renderer HSL as `[h(°), s(%), l(%)]` (see the catalog's HSL column). */
    colorHSL?: unknown;
    /** Sprite variants: `[r,g,b,a][]` (0–255). */
    colors?: { variants?: unknown };
}

/** The host `sandkit.api`, widened to everything this mod touches. */
export interface ApiSurface {
    items: {
        register(definition: Record<string, unknown>): void;
        isActiveById(itemId: string): boolean;
        getActive?(): { id?: string } | null;
    };
    terrains: {
        /** Terrain type for a string id (main + worker). */
        getTypeById?(id: string): number | null | undefined;
        /** Reverse lookup, when available. */
        getIdByType?(type: number): string | null | undefined;
        /** The terrain's definition (carries `metaColor` / `colorHSL`). */
        getDefinitionByType?(type: number): TerrainDefinitionLike | null | undefined;
    };
    settings: {
        get(name: string): unknown;
        onChange(fn: (values: Record<string, unknown>) => void): void;
    };
    sprites: {
        loadFromMod(spriteId: string, relativePath: string): Promise<void>;
    };
    player: {
        inventory: {
            hasById?(itemId: string): boolean;
            addById(itemId: string): void;
        };
    };
    i18n: {
        register(lang: string, map: Record<string, string>): void;
        /** Translate a key; returns the key itself when unknown. */
        t?(key: string, params?: Record<string, unknown>): string;
        /** Localized name for a definition (uses its `nameKey`/`name`). */
        getName?(def: unknown): string | null;
    };
    storage: {
        ensure(modId: string): unknown;
        get(modId: string, key: string): unknown;
        set(modId: string, key: string, value: unknown): void;
    };
    grid: {
        getDimensions?(): Size & { widthCells: number; heightCells: number };
    };
    rendering: {
        getDrawPositionAtWorld(worldX: number, worldY: number): Point;
        getGridMetrics(): { cellSize: number; snapGridCellSize: number };
        getOverlayViewportSize?(): Size;
        withOverlayContext(callback: (ctx: OverlayContext | null) => void): void;
    };
    events: {
        on(
            name: string,
            fn: (payload: Record<string, unknown>) => void,
            opts?: Record<string, unknown>,
        ): () => void;
    };
    ui: {
        toast(msg: string | Record<string, unknown>, opts?: Record<string, unknown>): void;
        overlays: {
            register(slot: string, id: string, render: () => unknown): void;
        };
    };
}

/** Runtime state of the hidden world for this session. */
export interface HiddenWorldState {
    /** Terrain seed (persisted in mod storage, save-backed). */
    seed: string;
    /** Hidden matrix size in cells — always the real map size. */
    width: number;
    height: number;
    /** Tunable generation parameters (percents; editable in the overlay). */
    params: GenerationParams;
    /** The matrix: one `TERRAIN` code per cell, row-major. */
    data: Uint8Array | null;
    /** Ghost layer opacity 0–1 (from the `ghostAlphaPercent` config, /100). */
    alpha: number;
    /** Set when matrix/cache building failed, to stop per-frame retries. */
    buildFailed: boolean;
    /** Cached 1px-per-cell canvas used for fast blitting. */
    cache: HTMLCanvasElement | null;
}

/** One 2D band (tunnel / cave) — percents keep every control integer-based. */
export interface BandParams {
    /** Band width: 0–50 (% of the ±Thickness band, /100). */
    thicknessPercent: number;
    /** Detail/cluster scale: 0–95 (% of Definition, /100 → zoom factor). */
    definitionPercent: number;
    /** Noise sample offset in cells. */
    offsetX: number;
    offsetY: number;
}

/** One skyline wave — period in cells (frequency = 1/period), amp in %. */
export interface SkyWave {
    /** Wavelength in cells (≥ 2); the web config's F ≈ 1/period. */
    periodCells: number;
    /** Wave amplitude in % (0–100, /100). */
    amplitudePercent: number;
}

/** The four skyline waves, named like the web generator's UI. */
export interface SkyParams {
    bigWave: SkyWave;
    mediumWave: SkyWave;
    lowWave: SkyWave;
    roughness: SkyWave;
}

/** Tunable "first step" generation parameters. */
export interface GenerationParams {
    /** The four configurable skyline waves. */
    sky: SkyParams;
    /** Ground level as % of the map height (skyline BaseHeight). */
    baseHeightPercent: number;
    tunnel: BandParams;
    cave: BandParams;
    /** Fluid fill step (ported from sandgenerator-web mapGeneration.js step 4). */
    fluid: FluidParams;
}

/**
 * Fluid fill parameters — the flood-fill CA step that runs *after* the
 * terrain matrix is built (sandgenerator-web `mapGeneration.js`, "Fluid
 * Generation"). The web generator hardcodes these inside the kernel loop
 * counts and `convKernelMakerReplaceInsideDistance` thresholds; they're
 * exposed here as tunable integers so the panel can drive them.
 */
export interface FluidParams {
    /** Fog (underground water) fill iterations — Step A (flow + pool grow). */
    fogWaterFlowIterations: number;
    /** Fog (underground water) fill iterations — Step B (column prune). */
    fogWaterPruneIterations: number;
    /** Minimum pool size (cells) to keep as water (else drained back to rock). */
    fogWaterMinPoolSize: number;
    /** Maximum pool size (cells) — pools larger than this are drained back. */
    fogWaterMaxPoolSize: number;

    /** Lava fill iterations — Step A (flow to the bottom). */
    lavaFlowIterations: number;
    /** Lava fill iterations — Step B (horizontal spread). */
    lavaSpreadIterations: number;
    /** Minimum pool size (cells) to keep as lava. */
    lavaMinPoolSize: number;
    /** Maximum pool size (cells) — pools larger than this drain back to rock. */
    lavaMaxPoolSize: number;

    /** Surface water (above-ground) fill iterations — Step A (density). */
    surfaceWaterFillIterations: number;
    /** Surface water fill iterations — Step B (edge pull-back). */
    surfaceWaterEdgeIterations: number;
    /** Minimum size (cells) for surface water to stay. */
    surfaceWaterMinSize: number;
    /** Maximum size (cells) — larger pools revert to sky. */
    surfaceWaterMaxSize: number;
}
