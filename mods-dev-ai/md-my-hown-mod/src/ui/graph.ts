/**
 * Laying out the object's relation graph, and finding the references that dangle.
 *
 * Kept as pure functions over plain data, with no React and no DOM, so the
 * layout and the dangling-reference detection can both be tested headlessly.
 * The rendering reads whatever comes out of here.
 *
 * The layout is deliberately not force-directed. A force simulation is prettier
 * on paper and useless in a settings panel: it re-arranges on every config
 * change, so a node you were looking at moves, and there is no "left" or
 * "above" to point at. This is a fixed layered layout instead — sources on the
 * left, targets on the right — so the same shape means the same thing every
 * time it is drawn.
 */

import type { Tab } from "./schema.ts";
import { CATEGORY_META } from "./schema.ts";
import { RELATIONS, relationsOf } from "./relations.ts";

export interface GraphNode {
    cat: Tab;
    label: string;
    /** How many entries of this kind the user currently has. */
    count: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface GraphEdge {
    from: Tab;
    to: Tab;
    field: string;
    note: string;
    required: boolean;
    /**
     * How many live references follow this edge. Zero means the relation is
     * declared but nothing in the current config uses it.
     */
    live: number;
    /**
     * How many of those point at an id that does not exist. These are the
     * entries that silently do nothing in-game.
     */
    dangling: number;
}

export interface DanglingRef {
    /** Category of the entry holding the bad reference. */
    from: Tab;
    /** The id of that entry. */
    fromId: string;
    field: string;
    /** The id that does not resolve. */
    target: string;
    to: Tab;
}

export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    width: number;
    height: number;
    /** Every dangling reference, spelled out, for a plain-language report. */
    danglingRefs: DanglingRef[];
}

const NODE_W = 168;
const NODE_H = 44;
const COL_GAP = 96;
const ROW_GAP = 18;
const PAD = 16;

/**
 * One colour per kind, used by every graph and by the list views.
 *
 * Assigned by *position* in a fixed order, not by hashing the name, so a kind
 * keeps the same colour when another kind is added. Hashing would silently
 * repaint half the graph the day someone added a category, which is exactly the
 * kind of quiet breakage a picture must not have.
 */
const PALETTE = [
    "#5b8ff9", "#61ddaa", "#f6bd16", "#e8684a", "#6dc8ec",
    "#9270ca", "#ff9d4d", "#269a9a", "#ff99c3", "#7ec82f",
] as const;

const COLOUR_ORDER: Tab[] = [
    "elements", "structures", "items", "recipes", "processing",
    "contacts", "interactions", "terrains", "techs", "upgrades",
    "categories", "inputs", "signals", "triggers", "behaviors",
    "energy", "excavation", "projectiles", "sprites", "modifiers",
];

/** A stable colour for a kind. The same kind is always the same colour. */
export function categoryColor(cat: Tab): string {
    const i = COLOUR_ORDER.indexOf(cat);
    // a kind added to the graph but not to COLOUR_ORDER still gets a stable
    // colour, it just is not one of the reserved palette slots
    return PALETTE[i < 0 ? COLOUR_ORDER.length % PALETTE.length : i % PALETTE.length];
}

/** A muted border for a node, so the fill reads as the identity. */
export function categoryBorder(cat: Tab): string {
    return categoryColor(cat);
}

/** Categories that can appear in the graph at all, in a stable display order. */
export function graphCategories(): Tab[] {
    const involved = new Set<Tab>();
    for (const r of RELATIONS) {
        involved.add(r.from);
        involved.add(r.to);
    }
    return [...involved];
}

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

/**
 * Every reference the current config makes that does not resolve.
 *
 * This is the most valuable thing on the screen. A terrain pointing at an
 * element that no longer exists produces no error anywhere — the entry
 * registers, the list looks fine, and the feature simply never happens.
 */
export function findDangling(cfg: Record<string, unknown>): DanglingRef[] {
    const out: DanglingRef[] = [];
    for (const r of RELATIONS) {
        const list = entriesOf(cfg, r.from);
        if (list.length === 0) continue;
        const known = new Set(entriesOf(cfg, r.to).map((e) => String(e.id ?? "")));
        // A reference into a kind the user has not created at all is not
        // "dangling" — it may legitimately point at a built-in.
        if (known.size === 0) continue;
        for (const entry of list) {
            const raw = entry[r.field];
            if (raw === undefined || raw === null || raw === "") continue;
            const ids = Array.isArray(raw) ? raw : [raw];
            for (const id of ids) {
                if (typeof id !== "string" && typeof id !== "number") continue;
                const s = String(id);
                if (s === "" || known.has(s)) continue;
                out.push({
                    from: r.from,
                    fromId: String(entry.id ?? "?"),
                    field: r.field,
                    target: s,
                    to: r.to,
                });
            }
        }
    }
    return out;
}

/** Count of live references along one edge, and how many of them dangle. */
function edgeCounts(
    cfg: Record<string, unknown>,
    from: Tab,
    field: string,
    to: Tab,
): { live: number; dangling: number } {
    const list = entriesOf(cfg, from);
    if (list.length === 0) return { live: 0, dangling: 0 };
    const known = new Set(entriesOf(cfg, to).map((e) => String(e.id ?? "")));
    let live = 0;
    let dangling = 0;
    for (const entry of list) {
        const raw = entry[field];
        if (raw === undefined || raw === null || raw === "") continue;
        const ids = Array.isArray(raw) ? raw : [raw];
        for (const id of ids) {
            if (typeof id !== "string" && typeof id !== "number") continue;
            const s = String(id);
            if (s === "") continue;
            live++;
            if (known.size > 0 && !known.has(s)) dangling++;
        }
    }
    return { live, dangling };
}

/**
 * Build the layout.
 *
 * Sources (kinds that point at something) are laid out down the left column and
 * targets down the right, so every edge reads left-to-right. A kind that is both
 * — `techs` points at itself — appears on the left only; the self-reference is
 * still drawn, and a second box would just make the picture busier.
 */
export function buildGraph(cfg: Record<string, unknown>): Graph {
    const sources = graphCategories().filter((c) => relationsOf(c).length > 0);
    const targets = [...new Set(RELATIONS.map((r) => r.to))];

    const makeNode = (cat: Tab, col: number, row: number): GraphNode => ({
        cat,
        label: CATEGORY_META[cat].label,
        count: entriesOf(cfg, cat).length,
        x: PAD + col * (NODE_W + COL_GAP),
        y: PAD + row * (NODE_H + ROW_GAP),
        w: NODE_W,
        h: NODE_H,
    });

    const nodes: GraphNode[] = [];
    sources.forEach((c, i) => nodes.push(makeNode(c, 0, i)));
    targets.forEach((c, i) => {
        if (sources.includes(c)) return;
        nodes.push(makeNode(c, 1, i));
    });

    const edges: GraphEdge[] = RELATIONS.map((r) => {
        const { live, dangling } = edgeCounts(cfg, r.from, r.field, r.to);
        return {
            from: r.from,
            to: r.to,
            field: r.field,
            note: r.note,
            required: r.strength === "required",
            live,
            dangling,
        };
    });

    const rows = Math.max(sources.length, targets.length);
    return {
        nodes,
        edges,
        width: PAD * 2 + NODE_W * 2 + COL_GAP,
        height: PAD * 2 + rows * (NODE_H + ROW_GAP),
        danglingRefs: findDangling(cfg),
    };
}

/**
 * The same graph as text, for the clipboard and for anyone reading a bug report.
 *
 * A picture you cannot paste into an issue is much less useful than it looks,
 * and this is nearly free once the data is assembled.
 */
export function graphAsText(graph: Graph): string {
    const lines: string[] = [];
    for (const n of graph.nodes) {
        lines.push(
            `${n.label}${n.count === 0 ? " (empty)" : ` — ${n.count} defined`}`,
        );
    }
    lines.push("");
    lines.push("References:");
    for (const e of graph.edges) {
        const bits = [
            `  ${CATEGORY_META[e.from].label} --${e.field}--> ${CATEGORY_META[e.to].label}`,
        ];
        if (e.required) bits.push("(required)");
        if (e.live > 0) bits.push(`[${e.live} live]`);
        if (e.dangling > 0) bits.push(`[${e.dangling} DANGLING]`);
        lines.push(bits.join(" "));
    }
    if (graph.danglingRefs.length > 0) {
        lines.push("");
        lines.push("Dangling references:");
        for (const d of graph.danglingRefs) {
            lines.push(
                `  ${CATEGORY_META[d.from].label} "${d.fromId}".${d.field}` +
                    ` -> ${d.target} (no such ${CATEGORY_META[d.to].label})`,
            );
        }
    }
    return lines.join("\n");
}

