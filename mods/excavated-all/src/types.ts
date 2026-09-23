/**
 * excavated-all — local typing for the runtime API surface.
 *
 * The bundled `@sandmd/sandkit` ambient declares most of the API; the members
 * this mod reaches for (terrain/element/structure removal, authorization,
 * grid.mutate, items/input/ui.overlays) are typed here and applied with a
 * single cast in `api.ts`, mirroring `md-admin-structure/types.ts`.
 */
import "@sandmd/sandkit";
import type { FilterKey } from "./ids.ts";

// --- React subset -----------------------------------------------------------

export type Setter<S> = (value: S | ((prev: S) => S)) => void;

export interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
}

// --- shared cell/point types -------------------------------------------------

export interface Cell {
    x: number;
    y: number;
}

// --- terrains ----------------------------------------------------------------

export interface TerrainsApi {
    getTypeAtCell(cx: number, cy: number): number | string | null;
    getIdByType?(type: number | string): string | null | undefined;
    getDefinitionByType?(type: number | string): { id?: string; name?: string } | null | undefined;
    getDataAtCell?(cx: number, cy: number): { hitPoints?: number; hp?: number } | null;
    isAtCell?(cx: number, cy: number): boolean;
    createAtCell?(cx: number, cy: number, ref: unknown): void;
    replaceAtCell?(cx: number, cy: number, ref: unknown): void;
    removeAtCell?(cx: number, cy: number, options?: Record<string, unknown>): void;
    damageAtCell?(cx: number, cy: number, damage: number): void;
    meltAtCell?(cx: number, cy: number): void;
    setHitPointsAtCell?(cx: number, cy: number, hp: number): void;
    setHpAtCell?(cx: number, cy: number, hp: number): void;
}

// --- elements ----------------------------------------------------------------

export interface ElementsApi {
    getTypeAtCell(cx: number, cy: number): number | string | null;
    getResolvedTypeAtCell?(cx: number, cy: number): number | string | null;
    createAtCell?(cx: number, cy: number, typeOrId: unknown, options?: unknown): void;
    replaceAtCell?(cx: number, cy: number, typeOrId: unknown, options?: unknown): void;
    removeAtCell?(cx: number, cy: number, options?: Record<string, unknown>): void;
}

// --- structures --------------------------------------------------------------

export interface StructureInstance {
    type?: number | string;
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
}

export interface StructuresApi {
    getAtCell(cx: number, cy: number): StructureInstance | null;
    removeAtCell?(cx: number, cy: number, options?: Record<string, unknown>): void;
    removeAtCells?(positions: Cell[], options?: Record<string, unknown>): void;
    removeBetweenCells?(x1: number, y1: number, x2: number, y2: number, options?: Record<string, unknown>): void;
}

// --- authorization -------------------------------------------------------------

export interface AuthorizationApi {
    canBuildAtCell?(cx: number, cy: number): boolean;
    canGrabAtCell?(cx: number, cy: number): boolean;
    canUseToolAtCell?(cx: number, cy: number, isFlamethrower?: boolean): boolean;
    getZoneIdAtCell?(cx: number, cy: number): unknown;
}

// --- grid ----------------------------------------------------------------------

export interface GridWriterTerrains {
    createAtCell?(cx: number, cy: number, ref: unknown): void;
    replaceAtCell?(cx: number, cy: number, ref: unknown): void;
    removeAtCell?(cx: number, cy: number, options?: Record<string, unknown>): void;
}

export interface GridWriterElements {
    createAtCell?(cx: number, cy: number, ref: unknown, options?: unknown): void;
    replaceAtCell?(cx: number, cy: number, ref: unknown, options?: unknown): void;
    removeAtCell?(cx: number, cy: number, options?: Record<string, unknown>): void;
}

export interface GridWriter {
    terrains: GridWriterTerrains;
    elements: GridWriterElements;
    reportActivityAtCell?(cx: number, cy: number): void;
}

export interface GridApi {
    getDimensions?(): { widthCells: number; heightCells: number };
    isCellEmptyAtCell?(cx: number, cy: number): boolean;
    isTerrainAtCell?(cx: number, cy: number): boolean;
    mutate?(callback: (writer: GridWriter) => void): void;
    reportActivityAtCell?(cx: number, cy: number): void;
    redrawAroundCell?(cx: number, cy: number, rangeCells: number): void;
}

// --- items / input / ui ---------------------------------------------------------

export interface ItemsApi {
    register(definition: Record<string, unknown>): void;
    isActiveById?(itemId: string, itemType?: unknown): boolean;
    getActive?(): { id?: string } | null;
}

export interface InventoryApi {
    hasById?(itemId: string): boolean;
    addById?(itemId: string): void;
    has?(itemId: string): boolean;
    add?(itemId: string): void;
}

export interface PlayerApi {
    inventory: InventoryApi;
}

export interface InputApi {
    registerBinding?(id: string, keys: string[], meta?: Record<string, unknown>): void;
    getMousePositionAtCell?(): Cell | null;
    getMouseCellPosition?(): Cell | null;
    isBindingDown?(id: string): boolean;
}

export interface OverlaysApi {
    register(slot: "hotbar" | "global", overlayId: string, render: () => unknown): void;
    unregister?(slot: "hotbar" | "global", overlayId: string): void;
}

export interface UiApi {
    toast(message: string | Record<string, unknown>, opts?: Record<string, unknown>): void;
    overlays: OverlaysApi;
    inject?: (id: string, component: unknown) => (() => void) | undefined;
}

export interface EventsApi {
    on(name: string, handler: (...args: unknown[]) => void): (() => void) | void;
}

export interface StorageApi {
    get?(modId: string, key: string): unknown;
    set?(modId: string, key: string, value: unknown): void;
}

export interface SpritesApi {
    loadFromMod(spriteId: string, relativePath: string, options?: Record<string, unknown>): Promise<void>;
}

export interface RenderingApi {
    getGridMetrics?(): { cellSize: number };
    getDrawPositionAtWorld?(x: number, y: number): { x: number; y: number };
    withOverlayContext?(fn: (ctx: CanvasRenderingContext2D | null) => void): void;
}

export interface I18nApi {
    register?(lang: string, entries: Record<string, string>): void;
}

export interface EnergyApi {
    consume?(amount: number): boolean | { ok: boolean } | void;
}

/** The widened `sandkit.api` handle this mod reads/writes. */
export interface RawApi {
    terrains: TerrainsApi;
    elements: ElementsApi;
    structures: StructuresApi;
    authorization: AuthorizationApi;
    grid: GridApi;
    items: ItemsApi;
    player: PlayerApi;
    input: InputApi;
    ui: UiApi;
    events: EventsApi;
    storage: StorageApi;
    sprites: SpritesApi;
    rendering: RenderingApi;
    i18n: I18nApi;
    energy?: EnergyApi;
}

// --- mod state -------------------------------------------------------------

export type FilterState = Record<FilterKey, boolean>;

export interface ExcavateStats {
    terrain: number;
    element: number;
    structure: number;
    skippedFixed: number;
    skippedAuth: number;
}

/** Inline CSS object accepted by the host React. */
export interface StyleObj {
    [key: string]: string | number | boolean;
}
