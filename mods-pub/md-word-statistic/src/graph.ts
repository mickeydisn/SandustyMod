/**
 * Lightweight SVG charts for stats history (no external deps).
 *
 * Card sparklines use a *strict* data min→max Y domain (no forced zero, no
 * extra padding) so small changes still show up. List charts keep light padding
 * for readability of labels.
 */
import { h } from "./api.ts";
import { COLORS } from "./styles.ts";

export interface SeriesLine {
    id: string;
    label: string;
    color: string;
    /** oldest → newest */
    values: number[];
}

const PALETTE = [
    "#ffe700",
    "#5ddea0",
    "#8ab4f8",
    "#ff6b7a",
    "#f0a060",
    "#c9a0ff",
    "#4fc3f7",
    "#e5b471",
];

export function seriesColor(index: number, fallback?: string): string {
    return fallback || PALETTE[index % PALETTE.length];
}

/** Strict domain: exact data min/max. Equal values → tiny epsilon so SVG still draws. */
export function yDomainStrict(values: number[]): { min: number; max: number } {
    const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
    if (nums.length === 0) return { min: 0, max: 1 };
    let lo = Math.min(...nums);
    let hi = Math.max(...nums);
    if (hi === lo) {
        // Keep a hair of span so a flat line sits mid-height, not clamped oddly
        const eps = Math.max(Math.abs(lo) * 1e-6, 1e-6);
        return { min: lo - eps, max: hi + eps };
    }
    return { min: lo, max: hi };
}

/** Padded domain for larger panel charts. */
export function yDomain(values: number[]): { min: number; max: number } {
    const { min, max } = yDomainStrict(values);
    if (max - min < 1e-9) {
        const pad = Math.max(1, Math.abs(min) * 0.05);
        return { min: min - pad, max: max + pad };
    }
    const span = max - min;
    const pad = Math.max(span * 0.08, 0.5);
    let lo = min - pad;
    let hi = max + pad;
    if (Math.min(...values.filter(Number.isFinite)) >= 0 && lo < 0) lo = 0;
    if (hi <= lo) hi = lo + 1;
    return { min: lo, max: hi };
}

/**
 * Compact sparkline for home cards — full width, no outer margin, Y = data min/max.
 * Single-point series draws a horizontal mid line with a dot (still “flat” by nature).
 */
export function Sparkline(
    values: number[],
    color: string,
    width = 160,
    height = 32,
): unknown {
    const e = h;
    if (!e) return null;
    if (!values.length) {
        return e("div", {
            style: {
                height: `${height}px`,
                width: "100%",
                color: COLORS.dim,
                fontSize: 9,
                display: "flex",
                alignItems: "center",
            },
        }, "no history");
    }

    // Same domain as MultiLineChart / list graphs
    const { min, max } = yDomain(values);
    const span = max - min || 1;
    const edge = 1;
    const n = values.length;
    const pts = values.map((v, i) => {
        const x = edge + (n === 1 ? 0.5 : i / (n - 1)) * (width - edge * 2);
        const y = edge + (1 - (v - min) / span) * (height - edge * 2);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

    const last = values[n - 1]!;
    const lastX = edge + (n === 1 ? 0.5 : 1) * (width - edge * 2);
    const lastY = edge + (1 - (last - min) / span) * (height - edge * 2);

    // Area under curve for a bit of “panel” feel
    const baseY = height - edge;
    const areaPts = n === 1
        ? `${edge},${baseY} ${lastX},${lastY} ${lastX},${baseY}`
        : `${edge},${baseY} ${pts} ${width - edge},${baseY}`;

    return e(
        "svg",
        {
            width: "100%",
            height,
            viewBox: `0 0 ${width} ${height}`,
            preserveAspectRatio: "none",
            style: { display: "block", width: "100%", height: `${height}px`, margin: 0, padding: 0 },
        },
        e("polygon", {
            fill: color,
            fillOpacity: 0.12,
            stroke: "none",
            points: areaPts,
        }),
        e("polyline", {
            fill: "none",
            stroke: color,
            strokeWidth: 1.75,
            points: pts,
            strokeLinejoin: "round",
            strokeLinecap: "round",
            vectorEffect: "non-scaling-stroke",
        }),
        e("circle", {
            cx: lastX,
            cy: lastY,
            r: 2.5,
            fill: color,
            vectorEffect: "non-scaling-stroke",
        }),
    );
}

export interface MultiLineOptions {
    width?: number;
    height?: number;
    /** Hide legend + use tighter margins (home cards). */
    compact?: boolean;
}

/** Multi-series line chart — same Y scaling for list tabs and card graphs. */
export function MultiLineChart(
    series: SeriesLine[],
    widthOrOpts: number | MultiLineOptions = 500,
    heightArg = 120,
): unknown {
    const e = h;
    if (!e) return null;

    let width = 500;
    let height = 120;
    let compact = false;
    if (typeof widthOrOpts === "object" && widthOrOpts !== null) {
        width = widthOrOpts.width ?? 500;
        height = widthOrOpts.height ?? 120;
        compact = !!widthOrOpts.compact;
    } else {
        width = widthOrOpts as number;
        height = heightArg;
    }

    if (!series.length || series.every((s) => s.values.length === 0)) {
        return e("div", {
            style: {
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.dim,
                fontSize: 11,
            },
        }, "Refresh a few times to build history");
    }

    const all: number[] = [];
    for (const s of series) {
        for (const v of s.values) all.push(v);
    }
    // Same domain helper as list charts (not the strict card-only one)
    const { min, max } = yDomain(all);
    const span = max - min || 1;

    // Compact = no labels/legend/grid; axis math (yDomain, yAt, xAt) identical
    const left = compact ? 4 : 36;
    const right = compact ? 4 : 8;
    const top = compact ? 4 : 8;
    const bottom = compact ? 4 : 16;
    const innerW = width - left - right;
    const innerH = height - top - bottom;

    const yAt = (v: number) => top + innerH - ((v - min) / span) * innerH;
    const xAt = (i: number, len: number) =>
        left + (i / Math.max(len - 1, 1)) * innerW;

    const gridLines = [0, 0.5, 1].map((t) => {
        const v = min + span * (1 - t);
        const y = top + innerH * t;
        return e("g", { key: `g${t}` },
            e("line", {
                x1: left, x2: width - right, y1: y, y2: y,
                stroke: "#1e2736", strokeWidth: 1,
            }),
            e("text", {
                x: left - 4, y: y + 3, fill: COLORS.dim, fontSize: 9, textAnchor: "end",
            }, Math.round(v).toLocaleString()),
        );
    });

    const lines = series.map((s, si) => {
        if (s.values.length === 0) return null;
        const pts = s.values.map((v, i) =>
            `${xAt(i, s.values.length).toFixed(1)},${yAt(v).toFixed(1)}`
        ).join(" ");
        return e("polyline", {
            key: s.id,
            fill: "none",
            stroke: s.color || seriesColor(si),
            strokeWidth: 2,
            points: pts,
            strokeLinejoin: "round",
            strokeLinecap: "round",
        });
    });

    const legend = series.map((s, si) =>
        e("div", {
            key: s.id,
            style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginRight: 10,
                fontSize: 10,
                color: COLORS.text,
            },
        },
            e("span", {
                style: {
                    width: 8, height: 8, borderRadius: 2,
                    background: s.color || seriesColor(si),
                    display: "inline-block",
                },
            }),
            e("span", null, s.label),
            e("span", { style: { color: COLORS.dim } },
                s.values.length ? `(${s.values[s.values.length - 1]!.toLocaleString()})` : ""),
        )
    );

    const svg = e("svg", {
        width: "100%",
        height,
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "xMidYMid meet",
        style: {
            display: "block",
            maxWidth: "100%",
            margin: 0,
            padding: 0,
        },
    }, ...(compact ? lines : [...gridLines, ...lines]));

    if (compact) {
        return e("div", {
            style: { width: "100%", margin: 0, padding: 0, lineHeight: 0 },
        }, svg);
    }

    return e("div", { style: { width: "100%" } },
        e("div", { style: { marginBottom: 4, display: "flex", flexWrap: "wrap", gap: 4 } }, ...legend),
        svg,
    );
}

export function formatDelta(d: number | null): string {
    if (d === null) return "—";
    if (d === 0) return "±0";
    return d > 0 ? `+${d.toLocaleString()}` : d.toLocaleString();
}
