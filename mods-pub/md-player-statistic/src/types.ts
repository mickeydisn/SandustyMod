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

/** Settings schema shape (mirrors modkit SettingsSchema). */
export type SettingsSchema = {
    readonly [key: string]: {
        readonly type: "boolean" | "number" | "choice" | "string";
        readonly default: boolean | number | string;
        readonly min?: number;
        readonly max?: number;
        readonly step?: number;
        readonly options?: readonly { readonly value: string; readonly label?: string }[];
    };
};

export type TabId = "home" | "actions" | "items" | "terrain" | "move" | "keys" | "config";

/** One selectable KPI on a Home card. */
export interface CardItemRef {
    /** KPI category. */
    category: string;
    /** Optional sub-key (itemId, structureId, resourceId, terrain type…). Empty = total for category. */
    key: string;
}

/** User-editable Home KPI card (persisted). */
export interface HomeCardConfig {
    id: string;
    title: string;
    /** First item is primary (big number + color source). */
    items: CardItemRef[];
}

/** Resolved count line inside a card. */
export interface CardItemStat {
    category: string;
    key: string;
    label: string;
    color: string;
    count: number;
    primary: boolean;
    /** current − session start (null if no session baseline). */
    delta: number | null;
    /** Last ≤10 history counts for sparkline (oldest → newest). */
    series: number[];
}

export interface CardStat {
    id: string;
    title: string;
    color: string;
    total: number;
    delta: number | null;
    items: CardItemStat[];
}

/** Flat counter map: "category" or "category::subKey" → count. */
export type KpiMap = Record<string, number>;

/** One persisted history snapshot. */
export interface KpiSnapshot {
    at: number;
    totals: KpiMap;
    /**
     * Session counters at this point. Optional because snapshots written
     * before this existed only carry `totals`; readers fall back to it.
     */
    session?: KpiMap;
}

/** Live buffer state. */
export interface KpiBuffer {
    /** Lifetime totals (persisted). */
    totals: KpiMap;
    /** Session totals (reset on load / explicit reset). */
    session: KpiMap;
    /** Session start timestamp. */
    sessionStartedAt: number;
    /** Rolling history of total snapshots. */
    history: KpiSnapshot[];
}

export interface PanelPos {
    right: number;
    top: number;
}
