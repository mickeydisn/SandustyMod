/**
 * Selectable list + multi-series history graph.
 *
 * The word statistic and player statistic mods both present their per-tab
 * breakdowns the same way: a multi-line history graph above a list of rows,
 * each with a checkbox that decides whether that row appears on the graph.
 * The graph auto-selects the top 3 rows until the user ticks something, so a
 * fresh tab is never blank.
 *
 * The mod owns the row data, the series values, and the selection state; this
 * module owns the markup and the selection bookkeeping.
 */
import { h } from "./api.ts";
import { COLORS, styles } from "./styles.ts";
import { formatCount, maxCount } from "./section.ts";
import { MultiLineChart } from "./graph.ts";
import type { SeriesLine } from "./graph.ts";
import type { StyleObj } from "./types.ts";

/** One selectable row in a list tab. */
export interface ListRow {
    /** Stable id — also the selection key. */
    id: string;
    name: string;
    count: number;
    /** Swatch / series colour. */
    color?: string;
    /** Dim secondary column, e.g. owning mod or category. */
    meta?: string;
}

/** Top N rows by count, used as the initial graph selection. */
export function defaultTopIds(rows: { id: string; count: number }[], n = 3): string[] {
    return rows.slice().sort((a, b) => b.count - a.count).slice(0, n).map((r) => r.id);
}

/** Stable pseudo-random colour from an id, for rows with no colour of their own. */
export function colorFromId(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const sat = 55 + (h % 25);
    const light = 55 + (h % 15);
    return `hsl(${hue} ${sat}% ${light}%)`;
}

/**
 * The ids that should be on the graph: the user's selection, or the top N
 * rows while nothing has been ticked yet.
 */
export function resolveSelection(
    selection: string[],
    rows: { id: string; count: number }[],
    topN = 3,
): string[] {
    return selection.length > 0 ? selection : defaultTopIds(rows, topN);
}

/**
 * Toggle one id in a selection.
 *
 * The first explicit tick is seeded from the current top-N defaults, so
 * unticking the top row does not suddenly clear the graph.
 */
export function toggleSelection(
    selection: string[],
    id: string,
    rows: { id: string; count: number }[],
    topN = 3,
): string[] {
    const cur = selection.length > 0 ? selection : defaultTopIds(rows, topN);
    return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

/**
 * Compact inline sparkline for KPI card rows.
 *
 * Distinct from `graph.ts`'s `Sparkline` (axis + grid) and `MultiLineChart`:
 * this is the tiny, chrome-less trend line that sits in a card row.
 */
export function MiniSparkline(series: number[], color: string): unknown {
    const e = h;
    if (!e || series.length === 0) return null;
    const w = 64;
    const ht = 18;
    const mx = Math.max(1, ...series);
    const pts = series
        .map((v, i) => {
            const x = (i / Math.max(1, series.length - 1)) * w;
            const y = ht - (v / mx) * (ht - 2) - 1;
            return `${x},${y}`;
        })
        .join(" ");
    return e(
        "svg",
        { width: w, height: ht, style: { display: "block", flexShrink: "0" } },
        e("polyline", {
            points: pts,
            fill: "none",
            stroke: color,
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeLinecap: "round",
        }),
    );
}

/**
 * Convert a cumulative series into per-interval deltas.
 *
 * Every KPI in `md-player-statistic` is a **lifetime accumulator**, so
 * plotting the raw values gives a monotonically rising ramp that says nothing
 * about activity. What is actually interesting is how much happened *during
 * each sampling interval*, so graphs plot `v[n] - v[n-1]`.
 *
 * The first sample has no predecessor, so the result is one point shorter and
 * starts at the second snapshot. Negative steps are clamped to zero: totals only
 * grow, so a negative delta means a reset or wipe happened, not a real
 * decrease.
 *
 * `md-word-statistic` does **not** use this — its counts are a world census
 * (digging reduces terrain, placing raises structures), so the absolute value
 * is the meaningful quantity and deltas would be misleading.
 */
export function toIntervals(values: number[]): number[] {
    const out: number[] = [];
    for (let i = 1; i < values.length; i++) {
        const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
        out.push(d > 0 ? d : 0);
    }
    return out;
}

export interface KpiCardItem {
    label: string;
    count: number;
    color: string;
    /** Oldest → newest history values for the inline sparkline. */
    series?: number[];
}

export interface KpiCardModel {
    id: string;
    title: string;
    /** Accent used for the left border, total and sparklines. */
    color: string;
    total: number;
    /** Change this session; null when there is no baseline. */
    delta: number | null;
    items: KpiCardItem[];
}

/**
 * The Home-tab KPI card: title, big total, a session delta, then one row per
 * tracked item with its own inline sparkline.
 *
 * Shared so `md-player-statistic` and `md-word-statistic` show the same card
 * even though their underlying data models differ.
 */
export function KpiCard(card: KpiCardModel): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        { key: card.id, style: { ...styles.card, borderLeftColor: card.color } },
        e("div", { style: styles.cardTitle }, card.title),
        e(
            "div",
            { style: { display: "flex", alignItems: "baseline", gap: "4px" } },
            e(
                "span",
                { style: { ...styles.cardTotal, color: card.color } },
                formatCount(card.total),
            ),
            card.delta != null && card.delta !== 0
                ? e(
                    "span",
                    {
                        style: {
                            ...styles.cardDelta,
                            color: card.delta > 0 ? COLORS.good : COLORS.danger,
                        },
                    },
                    card.delta > 0
                        ? `+${formatCount(card.delta)} session`
                        : `${formatCount(card.delta)} session`,
                )
                : null,
        ),
        card.items.length === 0 ? null : e(
            "div",
            { style: { marginTop: "6px" } },
            ...card.items.map((it) =>
                e(
                    "div",
                    { key: it.label, style: styles.row },
                    e("span", { style: styles.rowLabel }, it.label),
                    MiniSparkline(it.series ?? [], it.color),
                    e(
                        "span",
                        { style: { ...styles.rowCount, color: it.color } },
                        formatCount(it.count),
                    ),
                )
            ),
        ),
    );
}

export interface GraphBlockOptions {
    series: SeriesLine[];
    /** Heading above the chart. */
    title?: string;
    /** Shown when there are no series to plot. */
    emptyText?: string;
    width?: number;
    height?: number;
}

/** The bordered chart panel with an optional heading. */
export function GraphBlock(opts: GraphBlockOptions): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        { style: styles.graphBlock },
        opts.title ? e("div", { style: styles.groupTitle }, opts.title) : null,
        opts.series.length === 0
            ? e(
                "div",
                { style: { color: COLORS.dim, fontSize: 11, padding: "12px 0" } },
                opts.emptyText ??
                    "Tick some rows to plot them. History builds up over time.",
            )
            : MultiLineChart(opts.series, opts.width ?? 520, opts.height ?? 130),
    );
}

export interface SelectableListOptions {
    rows: ListRow[];
    /** Ids currently plotted on the graph. */
    selected: string[];
    /** Called with the id when a row's checkbox is toggled. */
    onToggle: (id: string) => void;
    /** Text shown when there are no rows. */
    emptyText?: string;
    /** Optional extra cell rendered after the count (e.g. "% dug"). */
    trailing?: (row: ListRow) => unknown;
    /**
     * Fully override one row's rendering. The checkbox is still built for you
     * and handed over, so toggling keeps working.
     */
    renderRow?: (row: ListRow, checkbox: unknown) => unknown;
}

const META_COL: StyleObj = {
    color: COLORS.dim,
    maxWidth: "110px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

/**
 * The checkbox list under a `GraphBlock`. Every row shows its swatch, name,
 * an optional dim meta column, a proportional bar and its count.
 */
export function SelectableList(opts: SelectableListOptions): unknown {
    const e = h;
    if (!e) return null;
    const { rows, selected, onToggle } = opts;
    if (rows.length === 0) {
        return e("div", { style: styles.empty }, opts.emptyText ?? "Nothing recorded yet.");
    }
    const max = maxCount(rows);

    return e(
        "div",
        { style: styles.list },
        ...rows.map((r) => {
            const checked = selected.includes(r.id);
            const checkbox = e("input", {
                type: "checkbox",
                checked,
                style: styles.rowCheck,
                title: "Show on graph",
                onChange: () => onToggle(r.id),
            });
            if (opts.renderRow) return opts.renderRow(r, checkbox);

            return e(
                "div",
                { key: r.id, style: styles.row },
                checkbox,
                e("div", { style: { ...styles.swatch, background: r.color } }),
                e("span", { style: styles.grow, title: r.name }, r.name),
                r.meta ? e("span", { style: META_COL }, r.meta) : null,
                e(
                    "div",
                    { style: styles.barTrack },
                    e("div", {
                        style: {
                            ...styles.barFill,
                            background: r.color,
                            width: `${Math.max(2, Math.round((100 * r.count) / max))}%`,
                        },
                    }),
                ),
                e("span", { style: styles.count }, formatCount(r.count)),
                opts.trailing ? opts.trailing(r) : null,
            );
        }),
    );
}
