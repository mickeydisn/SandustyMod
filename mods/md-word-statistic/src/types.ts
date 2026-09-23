/** Inline CSS object accepted by the host React. */
export interface StyleObj {
    [key: string]: string | number | boolean | undefined;
}

export type Setter<S> = (value: S | ((prev: S) => S)) => void;

export interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
    useMemo: <T>(fn: () => T, deps?: unknown[]) => T;
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T, deps?: unknown[]) => T;
}

export type TabId = "home" | "structures" | "elements" | "terrains";

/** List filter: everything, built-in only, or mod-added only. */
export type OriginFilter = "all" | "builtin" | "mod";

export type CardItemKind = "element" | "terrain" | "structure";

/** One selectable thing on a Home card. */
export interface CardItemRef {
    kind: CardItemKind;
    /** Stable engine / mod id (e.g. "gold", "wetsand", "dirt"). */
    id: string;
}

/** User-editable Home resource card (persisted). */
export interface HomeCardConfig {
    id: string;
    title: string;
    /** First item is primary (big number + color source). */
    items: CardItemRef[];
}

/** Resolved count line inside a card after a scan. */
export interface CardItemStat {
    kind: CardItemKind;
    id: string;
    label: string;
    color: string;
    count: number;
    /** True when this is the first configured item. */
    primary: boolean;
}

export interface CardStat {
    id: string;
    title: string;
    /** Primary color (from first item). */
    color: string;
    /** Sum of all item counts. */
    total: number;
    items: CardItemStat[];
}

export interface ElementRow {
    type: number;
    id: string;
    name: string;
    color: string;
    mod: string;
    builtin: boolean;
    count: number;
}

export interface StructureRow {
    id: string;
    name: string;
    mod: string;
    category: string;
    builtin: boolean;
    count: number;
}

export interface TerrainRow {
    type: number;
    id: string;
    name: string;
    color: string;
    builtin: boolean;
    count: number;
}

export interface ScanSnapshot {
    worldW: number;
    worldH: number;
    scannedCells: number;
    authorizedCells: number;
    skippedAuthCells: number;
    durationMs: number;
    at: number;
    elements: ElementRow[];
    structures: StructureRow[];
    terrains: TerrainRow[];
    totalElements: number;
    totalStructures: number;
    totalTerrains: number;
    emptyCells: number;
    emptyPercent: number;
    cards: CardStat[];
}

export interface ElementDefinition {
    id?: string;
    nameKey?: string;
    metaColor?: number;
    name?: string;
}

export interface StructureDefinition {
    id?: string;
    name?: string;
    nameKey?: string;
    categoryKey?: string;
    hideFromBuildMenu?: boolean;
}

export interface TerrainDefinition {
    id?: string;
    name?: string;
    nameKey?: string;
    metaColor?: number;
    color?: number;
}

/** Option shown in the card editor pickers. */
export interface PickerOption {
    kind: CardItemKind;
    id: string;
    label: string;
    color: string;
}
