import { h } from "./api.ts";
import { COLORS, styles } from "./styles.ts";
import type { BreakdownRow } from "./types.ts";

/** Largest count in a set of rows (at least 1, so bars never divide by zero). */
export function maxCount(rows: { count: number }[]): number {
    let m = 1;
    for (const r of rows) if (r.count > m) m = r.count;
    return m;
}

/**
 * Format a KPI count for display.
 *
 * Several KPIs are fractions rather than integers — `distance_walked` is
 * `pixels ÷ 16`, and interval series are differences of totals — so the raw
 * value prints as `5227.3634852967725`. Counts are rounded to at most one
 * decimal, and a whole number prints without a trailing `.0`.
 *
 * `maxFractionDigits` alone would not be enough: it rounds for display but
 * leaves values like `0.30000000000000004` intact when they arrive as noise
 * from floating-point subtraction, which `toIntervals` can produce.
 */
export function formatCount(n: number, maxDecimals = 1): string {
    if (!Number.isFinite(n)) return "—";
    const rounded = Number(n.toFixed(maxDecimals));
    return rounded.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

/** Unit suffix per category; absent means a plain count. */
export type KpiUnits = Record<string, string>;

/** Format a KPI for display, appending its unit when the category has one. */
export function formatKpi(cat: string, n: number, units?: KpiUnits): string {
    const unit = units?.[cat];
    return unit ? `${formatCount(n)} ${unit}` : formatCount(n);
}

export interface BreakdownOptions {
    /** Heading text; defaults to the category id. */
    title?: string;
    /** Row colour; defaults to the accent. */
    color?: string;
    units?: KpiUnits;
    /** Total shown in the heading. Omit to read 0. */
    total?: number;
    /** Draw the proportional bar. */
    bars?: boolean;
    marginTop?: number;
    /** Row label formatter. */
    label?: (key: string) => string;
}

/**
 * A "Category · total" heading plus one row per sub-key, with an optional
 * proportional bar. This is the shared shape behind every list tab in both
 * statistic mods, so they render identically.
 *
 * A category with no sub-keys (an accumulated total such as distance walked)
 * still has a meaningful heading, so the "None yet" placeholder only appears
 * when both the rows and the total are empty.
 */
export function Breakdown(
    cat: string,
    rows: BreakdownRow[],
    opts: BreakdownOptions = {},
): unknown {
    const e = h;
    if (!e) return null;
    const color = opts.color ?? COLORS.accent;
    const total = opts.total ?? 0;
    const mx = maxCount(rows);

    return e(
        "div",
        null,
        e(
            "div",
            { style: { ...styles.groupTitle, marginTop: opts.marginTop ?? 0 } },
            `${opts.title ?? cat} · ${formatKpi(cat, total, opts.units)}`,
        ),
        rows.length === 0 && total === 0
            ? e("div", { style: { color: COLORS.dim, fontSize: 11 } }, "None yet")
            : rows.map((r) =>
                e(
                    "div",
                    { key: r.key, style: styles.row },
                    e(
                        "span",
                        { style: { ...styles.grow, textAlign: "left" } },
                        opts.label ? opts.label(r.key) : r.key,
                    ),
                    opts.bars === false ? null : e(
                        "div",
                        { style: styles.barTrack },
                        e("div", {
                            style: {
                                ...styles.barFill,
                                width: `${Math.round((100 * r.count) / mx)}%`,
                                background: color,
                            },
                        }),
                    ),
                    e(
                        "span",
                        { style: { ...styles.count, color } },
                        formatKpi(cat, r.count, opts.units),
                    ),
                )
            ),
    );
}

/** Dimmed hint text used under a tab's content. */
export function Hint(text: string): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        { style: { color: COLORS.dim, fontSize: 11, marginTop: 10, lineHeight: 1.45 } },
        text,
    );
}

/** "Label" + control row used by the settings tab. */
export function CfgRow(label: string, control: unknown): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        { style: styles.cfgRow },
        e("span", { style: styles.cfgLabel }, label),
        e("div", { style: styles.cfgControl }, control),
    );
}

/** Uppercase section heading used by the settings tab and the card editor. */
export function CfgSection(title: string, marginTop?: number): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        { style: { ...styles.groupTitle, marginTop: marginTop ?? 0 } },
        title,
    );
}

export interface NumberRowOptions {
    min: number;
    max: number;
    step: number;
    /** Value used by the Reset button. */
    def: number;
    /** Appended to the displayed value, e.g. `" min"`. */
    suffix?: string;
    onChange: (v: number) => void;
}

/**
 * "− value + Reset" row for a numeric mod setting.
 *
 * Distinct from the chrome stepper in `ChromeRows`, which is for percentages
 * (zoom, opacity): this steps by the schema `step` and prints the raw value.
 */
export function NumberRow(
    label: string,
    value: number,
    opts: NumberRowOptions,
): unknown {
    const e = h;
    if (!e) return null;
    const { min, max, step, def, suffix = "" } = opts;
    const clampStep = (v: number): number => Math.min(max, Math.max(min, Number(v.toFixed(4))));
    return CfgRow(
        label,
        e(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6 } },
            e(
                "button",
                { style: styles.button, onClick: () => opts.onChange(clampStep(value - step)) },
                "−",
            ),
            e(
                "span",
                {
                    style: {
                        minWidth: 52,
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                    },
                },
                `${formatCount(value, 0)}${suffix}`,
            ),
            e(
                "button",
                { style: styles.button, onClick: () => opts.onChange(clampStep(value + step)) },
                "+",
            ),
            e(
                "button",
                {
                    style: styles.button,
                    title: `Reset to default (${def})`,
                    onClick: () => opts.onChange(def),
                },
                "Reset",
            ),
        ),
    );
}
