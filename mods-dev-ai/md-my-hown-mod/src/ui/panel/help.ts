import type { Tab } from "../schema.ts";
import { CATEGORY_META } from "../schema.ts";
import { buildGraph, categoryColor, type Graph, graphAsText, neighboursOf } from "../graph.ts";
import * as S from "../styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

export interface HelpProps {
    h: H;
    cfg: Record<string, unknown>;

    onGoTo: Click;

    onCopy: (text: string) => void;

    filter?: string;
    setFilter?: (next: string) => void;
}

export function renderHelp(props: HelpProps): unknown {
    const { h, cfg, onGoTo, onCopy } = props;
    const filter = props.filter ?? "all";
    const setFilter = props.setFilter ?? (() => {});

    const whole = buildGraph(cfg);

    const keep = filter === "all" ? null : filter === "nolink"
        ? new Set(
            whole.nodes
                .filter((n) => !whole.edges.some((e) => e.from === n.cat || e.to === n.cat))
                .map((n) => n.cat),
        )
        : neighboursOf(whole, filter as Tab);

    const shown = buildGraph(cfg, keep);
    const broken = shown.danglingRefs.length;

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        h(
            "div",
            { style: S.screenHead },
            h("span", { style: S.screenTitle }, "Graph"),
            h(
                "span",
                { style: S.screenBlurb },
                "What points at what — and what does not resolve.",
            ),
            h(
                "span",
                { style: S.chipCount },
                broken ? `${broken} broken` : `${shown.edges.length} relations`,
            ),
        ),
        filterMenu(h, whole, filter, setFilter),
        broken ? danglingReport(h, shown, onGoTo) : null,
        h(
            "div",
            { style: { margin: "8px 0" } },
            h(
                "button",
                { style: S.btn, onClick: () => onCopy(graphAsText(shown)) },
                "Copy this as text",
            ),
        ),
        shown.nodes.length === 0
            ? h(
                "div",
                { style: S.emptyState },
                filter
                    ? "Nothing to show — no kind sits under that filter yet."
                    : "No relations to draw.",
            )
            : renderGraph(h, shown, filter, onGoTo),
        relationTable(h, shown, filter, onGoTo, setFilter),
    );
}

function filterMenu(
    h: H,
    graph: Graph,
    filter: string,
    setFilter: (next: string) => void,
): unknown {
    const chip = (key: string, label: string, count?: number) =>
        h(
            "button",
            {
                key,
                style: filter === key ? S.chipActive : S.chip,
                onClick: () => setFilter(key),
            },
            label,
            count === undefined ? null : h("span", { style: S.chipCount }, String(count)),
        );

    const byGroup = new Map<string, typeof graph.nodes>();
    for (const n of graph.nodes) {
        byGroup.set(n.group, [...(byGroup.get(n.group) ?? []), n]);
    }

    return h(
        "div",
        { style: { ...S.subNav, marginTop: 6 } },
        chip("all", "All"),
        chip("nolink", "No links"),
        ...[...byGroup.entries()].flatMap(([key, nodes]) => [
            ...nodes.map((n) => chip(n.cat, n.label)),
        ]),
    );
}

function danglingReport(h: H, graph: Graph, onGoTo: Click): unknown {
    const bad = graph.danglingRefs;
    if (bad.length === 0) {
        return h(
            "div",
            {
                style: {
                    ...S.card,
                    marginBottom: 8,
                    borderColor: "rgba(90,200,140,0.4)",
                },
            },
            h("div", { style: S.sectionTitle }, "✓ No broken references"),
            h(
                "div",
                { style: S.hint },
                "Every id stored in this config points at an entry that exists.",
            ),
        );
    }
    return h(
        "div",
        { style: { ...S.card, borderColor: "#c0392b", marginBottom: 8 } },
        h(
            "div",
            { style: S.sectionTitle },
            `⚠ ${bad.length} broken reference${bad.length === 1 ? "" : "s"}`,
        ),
        h(
            "div",
            { style: S.hint },
            "These point at an entry that does not exist. The entry still saves, " +
                "but it will not do anything in-game until the id is fixed.",
        ),
        ...bad.map((d, i) =>
            h(
                "div",
                {
                    key: `dang-${i}`,
                    style: {
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    },
                },
                h(
                    "span",
                    {
                        style: { ...S.tagChip, cursor: "pointer" },
                        onClick: () => onGoTo(d.from),
                    },
                    CATEGORY_META[d.from].label,
                ),
                h("span", { style: S.hint }, ` “${d.fromId}” → ${d.field} = `),
                h("span", { style: { color: "#ff9b9b" } }, d.target),
                h(
                    "span",
                    { style: S.hint },
                    ` (no such ${CATEGORY_META[d.to].label.toLowerCase()})`,
                ),
            )
        ),
    );
}

function relationTable(
    h: H,
    graph: Graph,
    filter: string,
    onGoTo: Click,
    setFilter: (next: string) => void,
): unknown {
    const head = (label: string, right?: boolean) =>
        h(
            "div",
            {
                style: {
                    ...S.hint,
                    fontSize: 10,
                    textAlign: right ? "right" : "left",
                    flex: right ? "0 0 68px" : undefined,
                },
            },
            label,
        );

    const kind = (cat: Tab, onPick: () => void) =>
        h(
            "span",
            {
                style: {
                    ...S.tagChip,
                    cursor: "pointer",

                    boxShadow: filter === cat ? `0 0 0 1px ${categoryColor(cat)}` : undefined,
                },
                title: `Show ${CATEGORY_META[cat].label} and what it connects to`,
                onClick: onPick,
            },
            CATEGORY_META[cat].label,
        );

    return h(
        "div",
        { style: { marginTop: 10 } },
        h("div", { style: S.sectionTitle }, "Every reference, in words"),
        h(
            "div",
            { style: { display: "flex", gap: 6, marginTop: 4, padding: "0 2px" } },
            head("Holds"),
            head("Field"),
            head("Points at"),
            head("In use", true),
            head("Broken", true),
        ),
        ...graph.edges.map((e) =>
            h(
                "div",
                {
                    key: `rt-${e.from}-${e.field}-${e.to}`,
                    style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 2px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    },
                },
                kind(e.from, () => setFilter(e.from)),
                h(
                    "span",
                    { style: { color: "#cfe3ff", flex: "0 0 116px" }, title: e.note },
                    e.field,
                ),
                kind(e.to, () => setFilter(e.to)),
                h(
                    "span",
                    {
                        style: {
                            flex: "0 0 68px",
                            textAlign: "right",
                            color: e.live ? "#9fe0b0" : "#5c6579",
                        },
                    },
                    String(e.live),
                ),
                h(
                    "span",
                    {
                        style: {
                            flex: "0 0 68px",
                            textAlign: "right",
                            color: e.dangling ? "#ff6b6b" : "#5c6579",
                        },
                    },
                    e.dangling ? `${e.dangling} broken` : "—",
                ),
            )
        ),
    );
}

type Dir = "left" | "right" | "up" | "down";

function opposite(d: Dir): Dir {
    return d === "left" ? "right" : d === "right" ? "left" : d === "up" ? "down" : "up";
}

function head(
    h: H,
    x: number,
    y: number,
    dir: Dir,
    colour: string,
    width: number,
    opacity: number,
): unknown {
    const tipX = dir === "left" ? x - 5 : dir === "right" ? x + 5 : x;
    const tipY = dir === "up" ? y - 5 : dir === "down" ? y + 5 : y;
    const backX = dir === "left" || dir === "right" ? x : x + 5;
    const backY = dir === "up" || dir === "down" ? y : y + 6;
    return h(
        "path",
        {
            d: `M ${backX} ${backY} L ${tipX} ${tipY}`,
            fill: "none",
            stroke: colour,
            strokeWidth: width,
            strokeLinecap: "round",
            opacity,
        },
    );
}

function renderGraph(h: H, graph: Graph, filter: string, onGoTo: Click): unknown {
    const byCat = new Map(graph.nodes.map((n) => [n.cat, n]));

    const arrows = h(
        "svg",
        {
            style: {
                position: "absolute",
                left: 0,
                top: 0,
                width: `${graph.width}px`,
                height: `${graph.height}px`,
                pointerEvents: "none",
                overflow: "visible",
            },
        },
        ...graph.edges.flatMap((e) => {
            const a = byCat.get(e.from);
            const b = byCat.get(e.to);
            if (!a || !b) return [];
            const key = `${e.from}-${e.field}-${e.to}`;
            const colour = e.dangling > 0 ? "#ff6b6b" : e.required ? "#f6bd16" : "#5a6b85";
            const dim = e.live > 0 ? 1 : 0.35;
            const width = e.live > 0 ? 2 : 1;
            const dash = e.required ? "4 3" : undefined;

            const acx = a.x + a.w / 2;
            const acy = a.y + a.h / 2;
            const bcx = b.x + b.w / 2;
            const bcy = b.y + b.h / 2;

            if (acx === bcx && acy === bcy) {
                const cy = a.y - 18;
                return [
                    h(
                        "g",
                        { key: `${key}-edge` },
                        h("path", {
                            d: `M ${acx - 16} ${cy + 10} C ${acx - 22} ${cy - 12}, ${acx + 22} ${
                                cy - 12
                            }, ${acx + 16} ${cy + 10}`,
                            fill: "none",
                            stroke: colour,
                            strokeWidth: width,
                            strokeDasharray: dash,
                            opacity: dim,
                        }),
                        head(h, acx - 16, cy + 10, "left", colour, width, dim),
                        head(h, acx + 16, cy + 10, "right", colour, width, dim),
                    ),
                ];
            }

            const aMid = a.x + a.w / 2;
            const bMid = b.x + b.w / 2;
            const targetBelow = b.y + b.h / 2 > a.y + a.h / 2;
            const towards: Dir = targetBelow ? "down" : "up";

            const y1 = targetBelow ? a.y + a.h : a.y;
            const y2 = targetBelow ? b.y : b.y + b.h;
            let d: string;
            let endA: Dir = opposite(towards);
            let endB: Dir = towards;
            if (a.y === b.y) {
                const lo = Math.min(a.x, b.x);
                const hi = Math.max(a.x + a.w, b.x + b.w);
                const crossed = graph.columns.filter((c) => c.x + c.w > lo && c.x < hi);
                const toRight = bMid >= aMid;
                const detour = toRight
                    ? Math.max(...crossed.map((c) => c.x + c.w), hi) + 14
                    : Math.min(...crossed.map((c) => c.x), lo) - 14;
                const yMid = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
                const x1 = toRight ? a.x + a.w : a.x;
                const x2 = toRight ? b.x : b.x + b.w;
                d = `M ${x1} ${yMid} C ${detour} ${yMid}, ${detour} ${yMid}, ${x2} ${yMid}`;
                endA = toRight ? "right" : "left";
                endB = toRight ? "left" : "right";
            } else {
                const midY = (y1 + y2) / 2;
                const bow = bMid === aMid
                    ? 0
                    : Math.sign(bMid - aMid) * Math.min(70, Math.abs(bMid - aMid) / 2);
                d = `M ${aMid} ${y1} C ${aMid + bow} ${midY}, ${bMid + bow} ${midY}, ${bMid} ${y2}`;
            }

            return [
                h(
                    "g",
                    { key: `${key}-edge` },
                    h("path", {
                        d,
                        fill: "none",
                        stroke: colour,
                        strokeWidth: width,
                        strokeDasharray: dash,
                        opacity: dim,
                    }),
                    head(h, bMid, y2, endB, colour, width, dim),
                    head(h, aMid, y1, endA, colour, width, dim),
                ),
            ];
        }),
    );

    const boxes = graph.nodes.map((n) => {
        const picked = filter === n.cat;
        const near = filter && filter !== "all" && !picked;
        return h(
            "div",
            {
                key: `n-${n.cat}`,
                style: {
                    position: "absolute",
                    left: `${n.x}px`,
                    top: `${n.y}px`,
                    width: `${n.w}px`,
                    height: `${n.h}px`,
                    boxSizing: "border-box",
                    border: `1px solid ${categoryColor(n.cat)}`,
                    borderLeft: `4px solid ${categoryColor(n.cat)}`,
                    borderRadius: 4,
                    padding: "4px 6px",
                    cursor: "pointer",
                    zIndex: picked ? 2 : undefined,
                    background: picked ? "rgba(120,190,255,0.14)" : "rgba(255,255,255,0.03)",
                    opacity: near ? 0.7 : n.count === 0 ? 0.55 : 1,
                    boxShadow: picked ? `0 0 0 1px ${categoryColor(n.cat)}` : undefined,
                },
                title: [
                    n.count === 0
                        ? `${n.label}: none defined yet`
                        : `${n.label}: ${n.count} defined`,
                    picked ? " — the kind you filtered to" : "",
                ].join(""),
                onClick: () => onGoTo(n.cat),
            },
            h(
                "div",
                { style: { fontSize: "11px", fontWeight: picked ? 700 : 600 } },
                n.label,
            ),
            h(
                "div",
                { style: { ...S.hint, fontSize: "10px" } },
                n.count === 0 ? "empty" : `${n.count} defined`,
            ),
        );
    });

    const headings = graph.columns.map((c) => {
        const live = graph.nodes.some((n) => n.group === c.key);
        return h(
            "div",
            {
                key: `c-${c.key}`,
                style: {
                    position: "absolute",
                    left: `${c.x}px`,
                    top: `${c.y}px`,
                    width: `${c.w}px`,
                    height: `${c.h}px`,
                    boxSizing: "border-box",
                    border: "1px dashed rgba(120,140,180,0.20)",
                    borderRadius: 4,
                    opacity: live ? 1 : 0.35,
                    pointerEvents: "none",
                },
            },
            h(
                "div",
                {
                    style: {
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#8a97ad",
                        padding: "4px 6px 0",
                    },
                },
                c.label,
            ),
        );
    });

    return h(
        "div",
        {
            style: {
                position: "relative",
                width: `${graph.width}px`,
                height: `${graph.height}px`,
                margin: "10px 0",
                overflowX: "auto",
            },
        },
        ...headings,
        arrows,
        ...boxes,
    );
}
