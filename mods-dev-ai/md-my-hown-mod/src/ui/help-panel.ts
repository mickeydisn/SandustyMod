/**
 * The Graph screen: what the mod's objects point at, and what does not resolve.
 *
 * The screen is the graph and nothing else. It used to open with three
 * paragraphs of explanation and close with a per-kind field table; both are
 * gone, for the same reason. The paragraphs restated the picture, and the field
 * table was a hand-transcribed copy of the engine docs that read as
 * authoritative while drifting out of date. Every form field carries its own
 * hint and `doc/REFERENCE.md` carries the rest, so there was nothing left here
 * that was not either redundant or wrong.
 *
 * What remains cannot be looked up anywhere else: which of *your* entries point
 * at which, and which of those point at nothing.
 *
 * Everything is generated from `schema.ts` and `relations.ts`, the same sources
 * the editing forms use, so it cannot drift from them.
 */
import type { Tab } from "./schema.ts";
import { CATEGORY_META } from "./schema.ts";
import { buildGraph, categoryColor, type Graph, graphAsText, neighboursOf } from "./graph.ts";
import * as S from "./styles.ts";

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

export interface HelpProps {
    h: H;
    cfg: Record<string, unknown>;
    /** Jump to the screen that edits a kind. */
    onGoTo: Click;
    /** Copy text to the clipboard. */
    onCopy: (text: string) => void;
    /**
     * Which kind the graph is narrowed to. Optional, and defaults to `"all"`.
     *
     * The screen is complete without one — it is a view, not a wizard, and
     * "show me everything" is a perfectly good default. The panel passes it
     * explicitly because the panel is the only caller that can keep it across
     * remounts.
     */
    filter?: string;
    setFilter?: (next: string) => void;
}

export function renderHelp(props: HelpProps): unknown {
    const { h, cfg, onGoTo, onCopy } = props;
    const filter = props.filter ?? "all";
    const setFilter = props.setFilter ?? (() => {});

    // The full graph first, because "which kinds have no links at all" and "who
    // are this kind's neighbours" are questions about the *whole* relation set,
    // not about whatever happens to be on screen.
    const whole = buildGraph(cfg);

    // A selected kind narrows the picture to it and its direct neighbours.
    // `nolink` is the degenerate case: kinds with no edges at all, which is
    // exactly what "show me everything unconnected" needs and cannot express as
    // a single node. "all" means no filter at all — and it is spelled out
    // explicitly, because it is a non-empty string and would otherwise be
    // treated as a kind name, quietly emptying the screen.
    const keep = filter === "all" ? null : filter === "nolink"
        ? new Set(
            whole.nodes
                .filter((n) => !whole.edges.some((e) => e.from === n.cat || e.to === n.cat))
                .map((n) => n.cat),
        )
        : neighboursOf(whole, filter as Tab);

    // Re-laid out *from* the filter, not filtered after laying out. The kept kinds
    // get their depths re-derived and their slots re-packed, so a filtered graph
    // fills the panel instead of leaving five boxes marooned in one corner of a
    // diagram sized for sixteen.
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
        // The prose and the field tables used to live here. Both are gone: the
        // field tables were a second, worse copy of the engine docs — frozen at
        // build time, drifting from the real schema, and reading as
        // authoritative while being wrong — and the opening paragraphs only
        // restated what the picture already shows. Every form field carries its
        // own hint, and `doc/REFERENCE.md` carries the rest.
        //
        // What is left is the part that cannot be looked up anywhere: which of
        // *your* entries point at which, and which of those point at nothing.
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

/**
 * The filter row: every node in the graph, plus the unconnected ones.
 *
 * "All" first, then the groups in menu order, then the kinds within them. It is
 * the same order as the picture and the same order as the menu, so a kind is at
 * the same relative place in all three and none of them has to be learned
 * separately.
 */
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

/**
 * The most valuable thing on this screen.
 *
 * These are the references that resolve to nothing — the reason a feature
 * silently does not work. They are listed first, in red, with a jump to the
 * entry that holds the bad link, because everything else here is reference
 * material and this is a live bug report.
 */
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

/**
 * The same relations in words, because an arrow is not readable on a phone and
 * a picture cannot be pasted into a bug report.
 *
 * Each row is one field, and it carries the five things that decide whether it
 * matters: which kind holds it, which field it is, which kind it points at, how
 * many references currently follow it, and how many of those resolve to nothing.
 * The last two are the point — a relation can be declared by the engine and
 * still be doing nothing in your config, and the two counts are the only way to
 * tell those apart from a relation you are actively using.
 *
 * The kind names are the jump. Clicking one filters the graph to it, which is
 * why they are buttons and not plain text.
 */
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
                    // The row you are looking at, so a filtered table reads as a
                    // slice of the whole rather than as the whole.
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

/**
 * The relation picture.
 *
 * Drawn with positioned boxes and a real SVG layer for the arrows, rather than
 * a canvas: it inherits the panel's own styling, stays crisp, and the boxes
 * stay clickable so a node can take you to the thing it describes.
 *
 * The layout is the fixed one from `graph.ts` — grouped into the same columns
 * as the menu — so the shape means the same thing every time it is drawn, and a
 * node never moves because an unrelated entry was added. A picture you cannot
 * aim at is not a picture.
 */
/**
 * The direction an arrowhead points, from the point of view of the box it sits
 * on: `left` means the tip is to the left of its base.
 */
type Dir = "left" | "right" | "up" | "down";

/** The head at the far end points the other way — back along the same line. */
function opposite(d: Dir): Dir {
    return d === "left" ? "right" : d === "right" ? "left" : d === "up" ? "down" : "up";
}

/**
 * One arrowhead, drawn as a short stroke rather than a filled triangle.
 *
 * Deliberately inherits the line's own `stroke`, so one arrow stays one colour
 * at both ends, and its direction is always passed in from the geometry rather
 * than inferred here — a head can therefore never disagree with the line it is
 * attached to, which is the bug this replaced.
 */
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

            // One edge carries two arrowheads, and they mean different things:
            //
            //   → at the target — "this box is a *parameter of* that box".
            //                    A recipe pointing at an item is asking for it.
            //   ← at the source — "that box is *used in* this one".
            //                    The same relationship, read from the other end.
            //
            // Drawing only one would force a choice of whose point of view the
            // picture takes, and the question is rarely one-sided: you ask "what
            // can this reference?" going one way and "what references this?"
            // going the other, often in the same sitting. Two heads, one line.
            const acx = a.x + a.w / 2;
            const acy = a.y + a.h / 2;
            const bcx = b.x + b.w / 2;
            const bcy = b.y + b.h / 2;

            if (acx === bcx && acy === bcy) {
                // A self-reference (`techs` requiring other `techs`) has no
                // distance to draw across. A ring is the honest shape for it.
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
                        // Both heads point back at the box, because both readings
                        // are true of a thing that depends on itself.
                        head(h, acx - 16, cy + 10, "left", colour, width, dim),
                        head(h, acx + 16, cy + 10, "right", colour, width, dim),
                    ),
                ];
            }

            // An arrow leaves one box by the edge that faces the other and arrives
            // at the other's facing edge — so it runs *between* the two boxes, never
            // back through either one. The one exception is the same-height case
            // below.
            //
            // That is a deliberate constraint rather than a consequence of the
            // layout. Depth puts the target above, so a link between two kinds in
            // the same group would otherwise have to run sideways along the row,
            // skimming the boxes between it. Attaching to the facing edges gives
            // every link the same "it hangs off the end" reading, and it means a
            // head is never pointing at a box's flank where it is easy to mistake
            // for belonging to the neighbour.
            const aMid = a.x + a.w / 2;
            const bMid = b.x + b.w / 2;
            const targetBelow = b.y + b.h / 2 > a.y + a.h / 2;
            const towards: Dir = targetBelow ? "down" : "up";
            // Each end attaches to the edge that *faces* the other box, so the line
            // starts at A's near side and stops at B's near side. Leaving A by the
            // far edge instead would run the line back through A's own body before
            // it got anywhere, which is exactly the "arrow leaves by the top or
            // bottom" rule this is for — an end on the *wrong* horizontal edge is
            // worse than one on a side.
            const y1 = targetBelow ? a.y + a.h : a.y;
            const y2 = targetBelow ? b.y : b.y + b.h;
            let d: string;
            let endA: Dir = opposite(towards);
            let endB: Dir = towards;
            if (a.y === b.y) {
                // The same height. Both ends are within one box-height of each
                // other, so a direct curve between them is a horizontal line drawn
                // straight through every column in between — and no bow fixes it,
                // because a bow is still a curve between two points in the same
                // band.
                //
                // So it goes *around*: the arc leaves the source's side, swings
                // clear past the last group column it would otherwise cut through,
                // and comes back in from the target's other side. It reads as
                // "this one goes around", which is also the truth — the two kinds
                // sit at the same height, so the link has to get past the ones
                // between them somehow.
                //
                // "The last column it would cross" is the important part. Stopping
                // at the first gap looks right and is not: the columns are full of
                // boxes, and a shallow arc still lands inside one of them.
                //
                // This is the transpose of the layout it replaced, where the same
                // case dipped *below* the whole group row instead. Both ends now
                // attach to a side, which is the one place a head points sideways;
                // everything else still enters by the top and leaves by the bottom.
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
                // Different heights: a direct curve between the facing edges,
                // bowed by the horizontal gap so a long link is not a straight
                // vertical line painted over everything on the way.
                const midY = (y1 + y2) / 2;
                const bow = bMid === aMid
                    ? 0
                    : Math.sign(bMid - aMid) * Math.min(70, Math.abs(bMid - aMid) / 2);
                d = `M ${aMid} ${y1} C ${aMid + bow} ${midY}, ${bMid + bow} ${midY}, ${bMid} ${y2}`;
            }

            return [
                // One group per edge, always. The line and its two heads belong
                // to the same relationship, and wrapping them keeps "one arrow
                // per relation" a countable fact rather than something that has
                // to be re-derived from how many paths a head happens to take.
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
        // The kind you filtered to is drawn forward; its neighbours recede.
        // Without this the selected node is the same size and colour as
        // everything around it, and a filtered graph looks like the whole one
        // with a few boxes missing.
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

    // One heading per column, so the picture is arranged the way the menu is
    // rather than as an unlabelled field of boxes.
    const headings = graph.columns.map((c) => {
        // A column with nothing in the current filter keeps its heading but
        // dims, so the gap still reads as "a group that is filtered out" rather
        // than as a mistake in the layout.
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
