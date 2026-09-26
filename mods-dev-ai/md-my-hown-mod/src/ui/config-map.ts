/**
 * The configuration's own shape, instance by instance.
 *
 * `graph.ts` draws the *types* — "a terrain can point at an element". This
 * draws the *data* — "this terrain, `md-my-hown-mod:sand`, points at
 * `md-my-hown-mod:water`". Different questions, so a different module: the Help
 * screen teaches the model, and this screen shows the user's own.
 *
 * Nodes are grouped into one column per kind, with every entry in that kind
 * stacked under it. The grouping is what makes it readable — twenty loose boxes
 * on a canvas is noise, twenty boxes in labelled columns is a picture.
 */
import type { Tab } from "./schema.ts";
import { CATEGORY_META } from "./schema.ts";
import { RELATIONS } from "./relations.ts";
import { categoryColor } from "./graph.ts";
import * as S from "./styles.ts";

export interface InstanceNode {
    /** The kind this entry belongs to. */
    cat: Tab;
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** The column this entry sits in. */
    col: number;
    /** True when the entry is referenced by nothing at all. */
    orphan: boolean;
}

export interface InstanceEdge {
    fromCat: Tab;
    fromId: string;
    toCat: Tab;
    toId: string;
    field: string;
    /** True when the target id does not resolve to any entry. */
    broken: boolean;
}

export interface InstanceMap {
    /** One header per column, in column order. */
    columns: { cat: Tab; label: string; count: number; x: number; y: number }[];
    nodes: InstanceNode[];
    edges: InstanceEdge[];
    width: number;
    height: number;
    /** Entries that reference nothing, and are referenced by nothing. */
    orphans: string[];
    brokenEdges: InstanceEdge[];
}

const NODE_W = 170;
const NODE_H = 26;
const COL_GAP = 72;
const ROW_GAP = 6;
const HEAD_H = 34;
const PAD = 12;
/** Past this many entries in one kind, the column stops being useful. */
const MAX_PER_COL = 24;

function entriesOf(
    cfg: Record<string, unknown>,
    cat: Tab,
): Record<string, unknown>[] {
    const key = CATEGORY_META[cat]?.configKey;
    if (!key) return [];
    const raw = cfg[key as string];
    if (!Array.isArray(raw)) return [];
    return raw.filter((e: unknown): e is Record<string, unknown> =>
        typeof e === "object" && e !== null
    );
}

/** The kinds worth drawing, ordered so the layout is predictable. */
const MAP_ORDER: Tab[] = [
    "elements",
    "structures",
    "items",
    "terrains",
    "recipes",
    "processing",
    "contacts",
    "interactions",
    "techs",
    "categories",
    "upgrades",
    "signals",
    "triggers",
    "behaviors",
    "energy",
    "excavation",
    "projectiles",
    "inputs",
    "sprites",
    "modifiers",
];

/**
 * Build the instance map.
 *
 * A reference to an id that is not in the config is drawn as a broken edge
 * rather than dropped: it is the whole reason to look at this screen, and
 * silently omitting it would hide the one thing worth seeing.
 */
export function buildInstanceMap(cfg: Record<string, unknown>): InstanceMap {
    const present = new Set<Tab>();
    for (const cat of MAP_ORDER) {
        if (entriesOf(cfg, cat).length > 0) present.add(cat);
    }

    const index = new Map<string, InstanceNode>();
    const columns: InstanceMap["columns"] = [];
    const nodes: InstanceNode[] = [];
    let col = 0;
    for (const cat of MAP_ORDER) {
        const entries = entriesOf(cfg, cat);
        if (entries.length === 0) continue;
        const x = PAD + col * (NODE_W + COL_GAP);
        columns.push({
            cat,
            label: CATEGORY_META[cat].label,
            count: entries.length,
            x,
            y: PAD,
        });
        for (const [i, e] of entries.slice(0, MAX_PER_COL).entries()) {
            const id = String(e.id ?? "?");
            const node: InstanceNode = {
                cat,
                id,
                x,
                y: PAD + HEAD_H + i * (NODE_H + ROW_GAP),
                w: NODE_W,
                h: NODE_H,
                col,
                orphan: true,
            };
            nodes.push(node);
            index.set(`${cat}:${id}`, node);
        }
        col++;
    }

    const edges: InstanceEdge[] = [];
    for (const r of RELATIONS) {
        if (!present.has(r.from)) continue;
        for (const entry of entriesOf(cfg, r.from)) {
            const raw = entry[r.field];
            if (raw === undefined || raw === null || raw === "") continue;
            const ids = Array.isArray(raw) ? raw : [raw];
            for (const id of ids) {
                if (typeof id !== "string" && typeof id !== "number") continue;
                const target = String(id);
                if (target === "") continue;
                const hit = index.get(`${r.to}:${target}`);
                const fromNode = index.get(
                    `${r.from}:${String(entry.id ?? "?")}`,
                );
                if (hit) hit.orphan = false;
                if (fromNode) fromNode.orphan = false;
                edges.push({
                    fromCat: r.from,
                    fromId: String(entry.id ?? "?"),
                    toCat: r.to,
                    toId: target,
                    field: r.field,
                    broken: !hit,
                });
            }
        }
    }

    const brokenEdges = edges.filter((e) => e.broken);
    const orphans = nodes.filter((n) => n.orphan).map((n) => `${n.cat}:${n.id}`);
    const deepest = nodes.reduce(
        (m, n) => Math.max(m, n.y + n.h),
        PAD + HEAD_H,
    );

    return {
        columns,
        nodes,
        edges,
        width: PAD * 2 + Math.max(1, col) * (NODE_W + COL_GAP) - COL_GAP,
        height: deepest + PAD,
        orphans,
        brokenEdges,
    };
}

/**
 * The same map as text.
 *
 * More useful here than for the type graph, because "which of my twenty
 * triggers is the broken one" is a question a text file answers instantly and a
 * screenshot does not.
 */
export function instanceMapAsText(
    map: InstanceMap,
    cfg: Record<string, unknown>,
): string {
    const lines: string[] = [];
    for (const c of map.columns) {
        const shown = Math.min(c.count, MAX_PER_COL);
        lines.push(`${c.label} (${c.count})`);
        for (const e of entriesOf(cfg, c.cat).slice(0, shown)) {
            lines.push(`  ${String(e.id ?? "?")}`);
        }
        if (c.count > shown) lines.push(`  … and ${c.count - shown} more`);
        lines.push("");
    }
    if (map.edges.length > 0) {
        lines.push("References:");
        for (const e of map.edges) {
            lines.push(
                `  ${e.fromId}.${e.field} -> ${e.toId}` +
                    (e.broken ? "   [BROKEN]" : ""),
            );
        }
        lines.push("");
    }
    if (map.orphans.length > 0) {
        lines.push("Not referenced by anything:");
        for (const o of map.orphans) lines.push(`  ${o}`);
    } else {
        lines.push("Every entry is referenced by something.");
    }
    return lines.join("\n");
}

// ── rendering ────────────────────────────────────────────────────────────────

type H = (t: string, p: Record<string, unknown> | null, ...c: unknown[]) => unknown;
type Click = (key: string) => void;

export interface MapProps {
    h: H;
    cfg: Record<string, unknown>;
    /** Jump to the screen that edits a kind. */
    onGoTo: Click;
    onCopy: (text: string) => void;
}

/**
 * The Data screen's map of the user's own configuration.
 *
 * Deliberately a *different* picture from the Help screen's. Help draws the
 * model — every kind, whether or not the user has any of it. This draws the
 * data — one box per entry they actually made, in colour-coded columns, with
 * the links between them.
 */
export function renderConfigMap(props: MapProps): unknown {
    const { h, cfg, onGoTo, onCopy } = props;
    const map = buildInstanceMap(cfg);

    if (map.columns.length === 0) {
        return h(
            "div",
            { style: { padding: "0 10px 8px 10px" } },
            h(
                "div",
                { style: S.screenHead },
                h("span", { style: S.screenTitle }, "Map"),
            ),
            h(
                "div",
                { style: { ...S.card, marginTop: 8 } },
                h("div", { style: S.sectionTitle }, "Nothing to draw yet"),
                h(
                    "div",
                    { style: S.hint },
                    "You have not created any entries. Add one — an element or a " +
                        "terrain is a good start — and it will appear here.",
                ),
                h(
                    "div",
                    { style: { marginTop: 8 } },
                    h(
                        "button",
                        { style: S.btn, onClick: () => onGoTo("elements") },
                        "Go to Elements",
                    ),
                ),
            ),
        );
    }

    return h(
        "div",
        { style: { padding: "0 10px 8px 10px" } },
        h(
            "div",
            { style: S.screenHead },
            h("span", { style: S.screenTitle }, "Map"),
            h(
                "span",
                { style: S.screenBlurb },
                `${map.nodes.length} entries, ${map.edges.length} reference${
                    map.edges.length === 1 ? "" : "s"
                }.`,
            ),
        ),
        map.brokenEdges.length > 0 ? brokenBanner(h, map, onGoTo) : null,
        map.orphans.length > 0 ? orphanNote(h, map) : null,
        legend(h, map, onGoTo),
        h(
            "div",
            { style: { margin: "8px 0" } },
            h(
                "button",
                { style: S.btn, onClick: () => onCopy(instanceMapAsText(map, cfg)) },
                "Copy this as text",
            ),
        ),
        drawMap(h, map, onGoTo),
    );
}

function brokenBanner(h: H, map: InstanceMap, onGoTo: Click): unknown {
    return h(
        "div",
        { style: { ...S.card, borderColor: "#c0392b", marginBottom: 8 } },
        h(
            "div",
            { style: S.sectionTitle },
            `⚠ ${map.brokenEdges.length} reference${
                map.brokenEdges.length === 1 ? " points" : "s point"
            } at nothing`,
        ),
        h(
            "div",
            { style: S.hint },
            "Drawn in red below. These entries will not do anything in-game.",
        ),
        ...map.brokenEdges.slice(0, 12).map((e, i) =>
            h(
                "div",
                { key: `be-${i}`, style: { ...S.hint, marginTop: 3, marginLeft: 4 } },
                h(
                    "span",
                    {
                        style: { ...S.tagChip, cursor: "pointer" },
                        onClick: () => onGoTo(e.fromCat),
                    },
                    e.fromId,
                ),
                h("span", null, `.${e.field} → `),
                h("span", { style: { color: "#ff6b6b" } }, e.toId),
            )
        ),
        map.brokenEdges.length > 12
            ? h(
                "div",
                { style: { ...S.hint, marginTop: 3 } },
                `… and ${map.brokenEdges.length - 12} more.`,
            )
            : null,
    );
}

function orphanNote(h: H, map: InstanceMap): unknown {
    return h(
        "div",
        { style: { ...S.card, marginBottom: 8 } },
        h(
            "div",
            { style: S.sectionTitle },
            `${map.orphans.length} entr${
                map.orphans.length === 1 ? "y is" : "ies are"
            } not used anywhere`,
        ),
        h(
            "div",
            { style: S.hint },
            "Nothing points at these and they point at nothing. Often a typo, " +
                "or just something you have not wired up yet.",
        ),
        h(
            "div",
            { style: { ...S.hint, marginTop: 3 } },
            map.orphans.slice(0, 8).join(", ") +
                (map.orphans.length > 8 ? ` … and ${map.orphans.length - 8} more` : ""),
        ),
    );
}

/** The colour key, so a box's colour means something. */
function legend(h: H, map: InstanceMap, onGoTo: Click): unknown {
    return h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: 6, margin: "4px 0" } },
        ...map.columns.map((c) =>
            h(
                "span",
                {
                    key: `leg-${c.cat}`,
                    style: {
                        ...S.tagChip,
                        cursor: "pointer",
                        borderLeft: `4px solid ${categoryColor(c.cat)}`,
                        paddingLeft: 4,
                    },
                    title: `Go to ${c.label}`,
                    onClick: () => onGoTo(c.cat),
                },
                `${c.label} · ${c.count}`,
            )
        ),
    );
}

/** The map itself: one column per kind, one box per entry. */
function drawMap(h: H, map: InstanceMap, onGoTo: Click): unknown {
    const byId = new Map(map.nodes.map((n) => [`${n.cat}:${n.id}`, n]));

    const arrows = h(
        "svg",
        {
            style: {
                position: "absolute",
                left: 0,
                top: 0,
                width: `${map.width}px`,
                height: `${map.height}px`,
                pointerEvents: "none",
                overflow: "visible",
            },
        },
        ...map.edges.flatMap((e, i) => {
            const a = byId.get(`${e.fromCat}:${e.fromId}`);
            const b = byId.get(`${e.toCat}:${e.toId}`);
            if (!a || !b) return [];
            const x1 = a.x + a.w;
            const y1 = a.y + a.h / 2;
            const x2 = b.x;
            const y2 = b.y + b.h / 2;
            const mid = x1 + (x2 - x1) / 2;
            return [
                h("path", {
                    key: `ie-${i}-p`,
                    d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
                    fill: "none",
                    stroke: e.broken ? "#ff6b6b" : "rgba(150,180,220,0.45)",
                    strokeWidth: 1,
                    opacity: e.broken ? 0.9 : 0.5,
                }),
                h("circle", {
                    key: `ie-${i}-h`,
                    cx: x2,
                    cy: y2,
                    r: 2,
                    fill: e.broken ? "#ff6b6b" : "rgba(150,180,220,0.7)",
                }),
            ];
        }),
    );

    const headers = map.columns.map((c) =>
        h(
            "div",
            {
                key: `ch-${c.cat}`,
                style: {
                    position: "absolute",
                    left: `${c.x}px`,
                    top: `${c.y}px`,
                    width: "170px",
                    height: "34px",
                    boxSizing: "border-box",
                    borderBottom: `2px solid ${categoryColor(c.cat)}`,
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                },
                title: `Go to ${c.label}`,
                onClick: () => onGoTo(c.cat),
            },
            c.label,
            h("span", { style: { ...S.hint, fontWeight: 400 } }, ` · ${c.count}`),
        )
    );

    const boxes = map.nodes.map((n) =>
        h(
            "div",
            {
                key: `in-${n.cat}-${n.id}`,
                style: {
                    position: "absolute",
                    left: `${n.x}px`,
                    top: `${n.y}px`,
                    width: `${n.w}px`,
                    height: `${n.h}px`,
                    boxSizing: "border-box",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderLeft: `4px solid ${categoryColor(n.cat)}`,
                    borderRadius: 3,
                    padding: "2px 5px",
                    fontSize: "11px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    background: n.orphan ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                },
                title: n.orphan ? `${n.id} — not referenced by anything` : `${n.id}`,
                onClick: () => onGoTo(n.cat),
            },
            // the namespace is noise once you know the mod; show the bare id
            n.id.includes(":") ? n.id.split(":").slice(1).join(":") : n.id,
        )
    );

    return h(
        "div",
        {
            style: {
                position: "relative",
                width: `${map.width}px`,
                height: `${map.height}px`,
                margin: "10px 0",
                overflowX: "auto",
            },
        },
        arrows,
        ...headers,
        ...boxes,
    );
}
