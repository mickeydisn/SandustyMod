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

export interface FluidsParams {
  enabled: boolean;
  water: boolean;
  lava: boolean;
  surfaceWater: boolean;
  waterMinDepth: number;
  lavaMinDepth: number;
  surfaceWaterDepth: number;
}

/**
 * One wall-grow rule (sandgenerator WallGrow).
 * Easy to extend: add entries to DEFAULT_PARAMS.wallGrow.rules in constants.ts.
 *
 * nearMask: [up, right, down, left] — 1 = that neighbor must match inBorderOf.
 */
export interface WallRule {
  enabled: boolean;
  name: string;
  /** Neighbor terrain codes that "touch" the cell (from). */
  inBorderOf: number[];
  /** Cell codes we may replace (inside). */
  typeToReplace: number[];
  /** Code written into matching cells. */
  replaceBy: number;
  /** [up, right, down, left] — which sides check inBorderOf. */
  nearMask: [number, number, number, number];
  /** Sky-distance start as % of map height. */
  minDistPercent: number;
  /** Layer thickness as % of map height → maxDist = min + thickness. */
  thicknessPercent: number;
  /** Extra grow iterations into typeToReplace (4-connected). */
  growSize: number;
}

export interface WallGrowParams {
  enabled: boolean;
  rules: WallRule[];
}

/**
 * One form-grow rule (sandgenerator FormeGrow).
 * Add more in DEFAULT_PARAMS.formGrow.rules.
 */
export interface FormRule {
  enabled: boolean;
  name: string;
  /** Cells that may be replaced. */
  inBorderOf: number[];
  replaceBy: number;
  minDistPercent: number;
  thicknessPercent: number;
  growSize: number;
}

export interface FormGrowParams {
  enabled: boolean;
  rules: FormRule[];
}

export interface GenerationParams {
  sky: SkyParams;
  baseHeightPercent: number;
  tunnel: BandParams;
  cave: BandParams;
  seal: SealParams;
  fluids: FluidsParams;
  wallGrow: WallGrowParams;
  formGrow: FormGrowParams;
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
}
