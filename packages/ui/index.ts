/**
 * Shared overlay/UI layer for the Sandustry statistic mods.
 *
 * Everything visual lives here so `md-player-statistic` and
 * `md-word-statistic` render identically: the sandkit handle, the style
 * sheet, the panel chrome (header, tabs, drag, lock, zoom, opacity, mini
 * widget), the sparkline/multi-line graph, and the list/breakdown and
 * settings-row primitives. A mod supplies its own data layer, tab set, and
 * tab bodies.
 *
 * `deno bundle` inlines this into each mod's `build/main.js`, so mods stay
 * self-contained at runtime despite the workspace import.
 */

// Sandkit handle
export { api, h, React, root, safe, toast } from "./src/api.ts";

// Styles
export { COLORS, styles } from "./src/styles.ts";

// Graph
export {
    formatDelta,
    MultiLineChart,
    seriesColor,
    Sparkline,
    yDomain,
    yDomainStrict,
} from "./src/graph.ts";
export type { MultiLineOptions, SeriesLine } from "./src/graph.ts";

// Primitives
export {
    Breakdown,
    CfgRow,
    CfgSection,
    formatCount,
    formatKpi,
    Hint,
    maxCount,
    NumberRow,
} from "./src/section.ts";
export type { BreakdownOptions, KpiUnits, NumberRowOptions } from "./src/section.ts";

// Selectable list + graph
export {
    colorFromId,
    defaultTopIds,
    GraphBlock,
    KpiCard,
    MiniSparkline,
    resolveSelection,
    SelectableList,
    toggleSelection,
    toIntervals,
} from "./src/selectablelist.ts";
export type {
    GraphBlockOptions,
    KpiCardItem,
    KpiCardModel,
    ListRow,
    SelectableListOptions,
} from "./src/selectablelist.ts";

// Chrome
export {
    ChromeRows,
    Header,
    MiniHeader,
    posStyle,
    ROOT_CLASS,
    startDrag,
    Tabs,
} from "./src/chrome.ts";
export type { ChromeCtx, ChromeRowsOptions, HeaderOptions, TabsOptions } from "./src/chrome.ts";

// State + persistence
export { createPanelState } from "./src/state.ts";
export type { PanelController, PanelState, PanelStateOptions } from "./src/state.ts";
export { createUiStore } from "./src/uiStore.ts";
export type { UiStore } from "./src/uiStore.ts";

// Tool selection
export { isToolSelected } from "./src/select.ts";

// Tool + overlay registration
export { assertSpriteLoaded, ITEM_TYPE_TOOL, registerStatisticTool } from "./src/tool.ts";
export type { StatisticToolOptions, StatisticToolResult } from "./src/tool.ts";

// Types
export type {
    BreakdownRow,
    PanelPos,
    PanelReact,
    Setter,
    StyleObj,
    TabDef,
    UiStoreKeys,
    UiStoreOptions,
} from "./src/types.ts";
