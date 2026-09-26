/**
 * The Help screen: what the mod's objects are, and how they relate.
 *
 * Two subsections, because they answer two different questions:
 *
 *   1. "what is this thing and what can I set on it" — one card per object kind,
 *      its fields behind <details> so the screen stays scannable
 *   2. "what points at what" — the relation graph, with anything dangling
 *      called out at the top
 *
 * Everything here is generated from `schema.ts` and `relations.ts`, the same
 * sources the editing forms use. A hand-written help screen drifts from the form
 * within a week and then actively misleads; this one cannot, because there is
 * nothing to keep in sync.
 */
import type { Tab } from "./schema.ts";
import { CATEGORY_META } from "./schema.ts";
import { buildGraph, categoryColor, graphAsText, type Graph } from "./graph.ts";
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
}

export function renderHelp(props: HelpProps): unknown {
    const { h, cfg, onGoTo, onCopy } = props;
    const graph = buildGraph(cfg);

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        h(
            "div",
            { style: S.screenHead },
            h("span", { style: S.screenTitle }, "Help"),
            h(
                "span",
                { style: S.screenBlurb },
                "What points at what — and what does not resolve.",
            ),
        ),
        intro(h, onGoTo),
        danglingReport(h, graph, onGoTo),
        // The per-object field tables used to live here. They went because they
        // were a second, worse copy of the engine docs: a field list frozen at
        // build time, drifting from the real schema, and reading as
        // authoritative while being wrong. The form itself now carries a hint on
        // every field, and `doc/REFERENCE.md` carries the rest.
        //
        // What is left is the part that cannot be looked up anywhere: which of
        // *your* entries point at which, and which of those point at nothing.
        h(
            "div",
            { style: { ...S.sectionTitle, marginTop: 14 } },
            "How the objects relate",
        ),
        h(
            "div",
            { style: S.hint },
            "An arrow means “this field holds the id of that kind”. " +
                "A dashed arrow is one the engine requires. " +
                "Each row is one field, so two fields between the same pair stay separate.",
        ),
        h(
            "div",
            { style: { margin: "8px 0" } },
            h(
                "button",
                { style: S.btn, onClick: () => onCopy(graphAsText(graph)) },
                "Copy this as text",
            ),
        ),
        renderGraph(h, graph, onGoTo),
        edgeList(h, graph, onGoTo),
    );
}

/**
 * The three sentences that orient someone who has never seen this mod.
 *
 * The screen is long, and a long screen with no opening is one people bounce
 * off. This is the whole model in miniature: a kind is an entry, an entry can
 * point at other entries, and a pointer to something that no longer exists is
 * the one failure that is invisible until it happens in-game.
 */
function intro(h: H, onGoTo: Click): unknown {
    const points: [string, string][] = [
        [
            "Everything is a list of entries",
            "Each kind of thing — an element, a structure, a trigger — is a list you add to. An entry has an id, and that id is how everything else finds it.",
        ],
        [
            "Entries point at each other",
            "A terrain names the element it drops. A trigger names the signal that fires it. Those links are typed: an element id in a field that wants a terrain id is simply ignored.",
        ],
        [
            "A broken link fails quietly",
            "If an entry names something that does not exist, nothing complains. The entry saves, the list looks fine, and the feature never happens in-game. The red panel below finds those for you.",
        ],
    ];
    return h(
        "div",
        { style: { ...S.card, marginBottom: 8, borderColor: "rgba(120,180,255,0.35)" } },
        h("div", { style: S.sectionTitle }, "How this mod works"),
        ...points.map(([title, body], i) =>
            h(
                "div",
                {
                    key: `intro-${i}`,
                    style: {
                        display: "flex",
                        gap: 8,
                        marginTop: 6,
                        alignItems: "flex-start",
                    },
                },
                h(
                    "span",
                    {
                        style: {
                            ...S.tagChip,
                            cursor: "pointer",
                            minWidth: 16,
                            textAlign: "center",
                        },
                        title: "See the objects",
                        onClick: () => onGoTo("elements"),
                    },
                    String(i + 1),
                ),
                h(
                    "div",
                    null,
                    h("div", null, title),
                    h("div", { style: S.hint }, body),
                ),
            )
        ),
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
 * The relation picture.
 *
 * Drawn with positioned boxes and a real SVG layer for the arrows, rather than
 * a canvas: it inherits the panel's own styling, stays crisp, and the boxes
 * stay clickable so a node can take you to the thing it describes.
 *
 * The layout is the fixed one from `graph.ts`, so the shape means the same
 * thing every time it is drawn — a node that moves when nothing changed would
 * be useless to aim at.
 */
function renderGraph(h: H, graph: Graph, onGoTo: Click): unknown {
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
            const x1 = a.x + a.w;
            const y1 = a.y + a.h / 2;
            const x2 = b.x;
            const y2 = b.y + b.h / 2;
            const mid = x1 + (x2 - x1) / 2;
            const colour = e.dangling > 0 ? "#ff6b6b" : e.required ? "#f6bd16" : "#5a6b85";
            return [
                h("path", {
                    key: `${e.from}-${e.field}-${e.to}-p`,
                    d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
                    fill: "none",
                    stroke: colour,
                    strokeWidth: e.live > 0 ? 2 : 1,
                    strokeDasharray: e.required ? "4 3" : undefined,
                    opacity: e.live > 0 ? 1 : 0.35,
                }),
                h("circle", {
                    key: `${e.from}-${e.field}-${e.to}-h`,
                    cx: x2,
                    cy: y2,
                    r: 2.5,
                    fill: colour,
                }),
            ];
        }),
    );

    const boxes = graph.nodes.map((n) =>
        h(
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
                    background: "rgba(255,255,255,0.03)",
                    opacity: n.count === 0 ? 0.55 : 1,
                },
                title: n.count === 0
                    ? `${n.label}: none defined yet`
                    : `${n.label}: ${n.count} defined`,
                onClick: () => onGoTo(n.cat),
            },
            h(
                "div",
                { style: { fontSize: "11px", fontWeight: 600 } },
                n.label,
            ),
            h(
                "div",
                { style: { ...S.hint, fontSize: "10px" } },
                n.count === 0 ? "empty" : `${n.count} defined`,
            ),
        )
    );

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
        arrows,
        ...boxes,
    );
}

/**
 * The same relations as text, because an arrow is not readable on a phone and
 * a picture cannot be pasted into a bug report.
 */
function edgeList(h: H, graph: Graph, onGoTo: Click): unknown {
    const byFrom = new Map<Tab, typeof graph.edges>();
    for (const e of graph.edges) {
        byFrom.set(e.from, [...(byFrom.get(e.from) ?? []), e]);
    }
    return h(
        "div",
        { style: { marginTop: 10 } },
        h("div", { style: S.sectionTitle }, "Every reference, in words"),
        ...[...byFrom.entries()].map(([cat, edges]) =>
            h(
                "div",
                { key: `el-${cat}`, style: { marginTop: 6 } },
                h(
                    "span",
                    {
                        style: { ...S.tagChip, cursor: "pointer" },
                        onClick: () => onGoTo(cat),
                    },
                    CATEGORY_META[cat].label,
                ),
                ...edges.map((e) =>
                    h(
                        "div",
                        {
                            key: `el-${cat}-${e.field}`,
                            style: { ...S.hint, marginTop: 2, marginLeft: 4 },
                        },
                        h("span", { style: { color: "#cfe3ff" } }, e.field),
                        h("span", null, " → " + CATEGORY_META[e.to].label),
                        e.required
                            ? h("span", { style: { color: "#f6bd16" } }, " (required)")
                            : null,
                        e.live > 0
                            ? h("span", { style: { color: "#9fe0b0" } }, ` — ${e.live} in use`)
                            : null,
                        e.dangling > 0
                            ? h(
                                "span",
                                { style: { color: "#ff6b6b" } },
                                ` — ${e.dangling} broken`,
                            )
                            : null,
                    )
                ),
            )
        ),
    );
}

