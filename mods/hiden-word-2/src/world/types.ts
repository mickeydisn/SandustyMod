export type OverlayContext = {
  save(): void;
  restore(): void;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  drawImage(
    image: CanvasImageSource,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void;
};

export type Rgba = [number, number, number, number];

export interface TerrainDefinitionLike {
  id?: unknown;
  name?: unknown;
  nameKey?: unknown;
  color?: unknown;
  metaColor?: unknown;
  colorHSL?: unknown;
  colors?: { variants?: unknown };
}

export interface ApiSurface {
  items: {
    register(definition: Record<string, unknown>): void;
    isActiveById(itemId: string): boolean;
    getActive?(): { id?: string } | null;
  };
  terrains: {
    getTypeById?(id: string): number | null | undefined;
    getDefinitionByType?(type: number): TerrainDefinitionLike | null | undefined;
  };
  settings: {
    get(name: string): unknown;
    onChange(fn: (values: Record<string, unknown>) => void): void;
  };
  sprites: { loadFromMod(spriteId: string, relativePath: string): Promise<void> };
  player: {
    inventory: {
      hasById?(itemId: string): boolean;
      addById(itemId: string): void;
    };
  };
  i18n: {
    register(lang: string, map: Record<string, string>): void;
    t?(key: string, params?: Record<string, unknown>): string;
  };
  storage: {
    ensure(modId: string): unknown;
    get(modId: string, key: string): unknown;
    set(modId: string, key: string, value: unknown): void;
  };
  grid: {
    getDimensions?(): { widthCells: number; heightCells: number; width?: number; height?: number };
  };
  rendering: {
    getDrawPositionAtWorld(worldX: number, worldY: number): { x: number; y: number };
    getGridMetrics(): { cellSize: number; snapGridCellSize: number };
    getOverlayViewportSize?(): { width: number; height: number };
    withOverlayContext(callback: (ctx: OverlayContext | null) => void): void;
  };
  events: {
    on(name: string, fn: (payload: Record<string, unknown>) => void, opts?: Record<string, unknown>): () => void;
  };
  ui: {
    toast(msg: string | Record<string, unknown>, opts?: Record<string, unknown>): void;
    overlays: { register(slot: string, id: string, render: () => unknown): void };
  };
}

export interface SkyWave {
  periodCells: number;
  amplitudePercent: number;
}

export interface SkyParams {
  bigWave: SkyWave;
  mediumWave: SkyWave;
  lowWave: SkyWave;
  roughness: SkyWave;
}

export interface BandParams {
  enabled: boolean;
  thicknessPercent: number;
  definitionPercent: number;
  offsetX: number;
  offsetY: number;
}

export interface SealParams {
  enabled: boolean;
  maxIterations: number;
  sealTunnels: boolean;
  sealCaves: boolean;
  diagonal: boolean;
  surfaceKeepPercent: number;
}

/** Axis-aligned band as % of full map. */
export interface MapBoundsPercent {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type ModifierKind = "wall" | "form" | "liquid";

export interface ModifierBase {
  id: string;
  enabled: boolean;
  name: string;
  kind: ModifierKind;
}

export interface WallModifier extends ModifierBase {
  kind: "wall";
  inBorderOf: number[];
  typeToReplace: number[];
  replaceBy: number;
  nearMask: [number, number, number, number];
  bounds: MapBoundsPercent;
  growSize: number;
}

export interface FormModifier extends ModifierBase {
  kind: "form";
  inBorderOf: number[];
  replaceBy: number;
  bounds: MapBoundsPercent;
  growSize: number;
  scatterPercent: number;
}

export type LiquidType = "water" | "lava" | "surface";

export interface LiquidModifier extends ModifierBase {
  kind: "liquid";
  liquidType: LiquidType;
  minDepth: number;
  bounds: MapBoundsPercent;
}

export type Modifier = WallModifier | FormModifier | LiquidModifier;

export interface GenerationParams {
  sky: SkyParams;
  baseHeightPercent: number;
  tunnel: BandParams;
  cave: BandParams;
  seal: SealParams;
  /** Ordered post-seal pipeline — user can reorder. */
  modifiers: Modifier[];
  /** When true: fog-of-war exploration layer is active. */
  explorationEnabled: boolean;
}

export interface HiddenWorldState {
  seed: string;
  width: number;
  height: number;
  params: GenerationParams;
  data: Uint8Array | null;
  skyDistance: Int16Array | null;
  alpha: number;
  buildFailed: boolean;
  cache: HTMLCanvasElement | null;
  /** Legacy alias — same buffer as tags when exploration on. */
  explored: Uint8Array | null;
  /** 0 Hidden, 1 Explored, 2 Materialised (same size as data when on). */
  tags: Uint8Array | null;
}
