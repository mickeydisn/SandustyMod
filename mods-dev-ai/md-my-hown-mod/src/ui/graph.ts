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
import { CATEGORY_META, MENU_GROUPS } from "./schema.ts";
import { RELATIONS, relationsOf } from "./relations.ts";
import {
    listElements,
    listItems,
    listSpriteIds,
    listStructures,
    listTechIds,
    listTerrains,
    listUnlockNodes,
} from "../catalog.ts";
import { DEFAULT_UNLOCK_NODE } from "./tech-link.ts";

export interface GraphNode {
    cat: Tab;
    label: string;
    /**
     * The menu group this kind sits under. Drives the row it lands in.
     *
     * A group is a *row*: it runs across the picture, not down it. (The type is
     * still called `GraphColumn` and the field `columns` — a leftover from when
     * groups were columns. Worth saying so nobody redraws it the other way.)
     */
    group: string;
    groupLabel: string;
    /**
     * How far along the dependency chain this kind sits: 0 for a kind that
     * references nothing, 1 for one that only references those, and so on by
     * longest path.
     *
     * This is the column. Left-to-right is dependency order — what can be built
     * from nothing, then what needs that, then what needs that — so an arrow
     * between two columns already says "this one uses that one" without anyone
     * having to follow the line.
     */
    depth: number;
    /** How many entries of this kind the user currently has. */
    count: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * A group of the graph: one menu group, and the kinds under it.
 *
 * Groups are the menu's own groups, so the picture is arranged the way the
 * question already is, and each one is a horizontal **row** stacked below the
 * last. They are ordered by the *shallowest* kind inside each — see
 * `buildGraph` — so the groups that feed the graph come first and a group that
 * only consumes sits below what it consumes.
 *
 * The type is still called `GraphColumn` and the field is still `columns`. That
 * is a leftover from when groups were columns, and it is worth saying plainly:
 * the field holds rows.
 */
export interface GraphColumn {
    key: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** How many kinds in this group. */
    count: number;
    /** The shallowest depth in this group — what it is ordered by. */
    minDepth: number;
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
    /** One per menu group that has at least one kind in the graph. */
    columns: GraphColumn[];
    width: number;
    height: number;
    /** Every dangling reference, spelled out, for a plain-language report. */
    danglingRefs: DanglingRef[];
}

const NODE_W = 168;
const NODE_H = 44;
const COL_GAP = 40;
/** Space above the first node of a column, for the group heading. */
const HEAD_H = 26;
/**
 * Space reserved at the left of every row for the group's name.
 *
 * Wide enough for the longest label the menu has, and deliberately not a column
 * of its own: the label names the *row* it sits in, so putting the rows side by
 * side would spend the same width on repeating it seven times.
 */
const HEAD_W = 96;
/** Vertical gap between one group row and the next. */
const GROUP_GAP = 26;
const ROW_GAP = 14;
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
    "#5b8ff9",
    "#61ddaa",
    "#f6bd16",
    "#e8684a",
    "#6dc8ec",
    "#9270ca",
    "#ff9d4d",
    "#269a9a",
    "#ff99c3",
    "#7ec82f",
] as const;

const COLOUR_ORDER: Tab[] = [
    "elements",
    "structures",
    "items",
    "recipes",
    "processing",
    "contacts",
    "interactions",
    "terrains",
    "techs",
    "upgrades",
    "categories",
    "inputs",
    "signals",
    "triggers",
    "behaviors",
    "energy",
    "excavation",
    "projectiles",
    "sprites",
    "modifiers",
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
 * Ids the *game* already owns, for one target tab.
 *
 * The dangling check has to know about built-ins. Before this, `known` held
 * only the mod's own entries, so a contact reaction pointing at the game's
 * "Sand" was reported as a broken reference the moment the mod had even one
 * element of its own — which is exactly what the picker tells you to do. The
 * pickers offer game ids, so the check has to accept them.
 *
 * `includeHidden: true` matters: a mod that deliberately points at an internal
 * element has a reference that *does* resolve, and reporting it as dangling
 * would be a false alarm that invites the user to "fix" something that works.
 *
 * Returns an empty set when the host is unavailable, which degrades to the old
 * config-only behaviour rather than reporting every built-in as broken.
 */
const GAME_ID_LOADERS: Partial<Record<Tab, () => string[]>> = {
    elements: () => listElements({ includeHidden: true }).map((o) => o.value),
    items: () => listItems().map((o) => o.value),
    terrains: () => listTerrains().map((o) => o.value),
    structures: () => listStructures().map((o) => o.value),
    sprites: () => listSpriteIds().map((o) => o.value),
    techs: () => listTechIds().map((o) => o.value),
    // The built-in default is a real, selectable node even though it is not stored,
    // so a structure pointing at it must resolve rather than being reported as a
    // dangling link — it is a *virtual* entry, not a missing one.
    unlockNodes: () => listUnlockNodes().map((o) => o.value),
};

function gameIds(tab: Tab): Set<string> {
    const load = GAME_ID_LOADERS[tab];
    if (!load) return new Set();
    const out = new Set<string>();
    try {
        for (const id of load()) if (id) out.add(id);
    } catch {
        return new Set();
    }
    return out;
}

/**
 * Every reference the current config makes that does not resolve.
 *
 * This is the most valuable thing on the screen. A terrain pointing at an
 * element that no longer exists produces no error anywhere — the entry
 * registers, the list looks fine, and the feature simply never happens.
 *
 * `known` is injectable so this stays testable headless; the default asks the
 * host, and an unavailable host degrades to config-only rather than crying wolf.
 */
export function findDangling(
    cfg: Record<string, unknown>,
    known?: (tab: Tab) => Set<string>,
): DanglingRef[] {
    const builtins = known ?? gameIds;
    const out: DanglingRef[] = [];
    for (const r of RELATIONS) {
        const list = entriesOf(cfg, r.from);
        if (list.length === 0) continue;
        const known = new Set(entriesOf(cfg, r.to).map((e) => String(e.id ?? "")));
        for (const id of builtins(r.to)) known.add(id);
        // A reference into a kind that nothing knows about — neither the mod's
        // config nor the host — is not "dangling", we simply cannot tell.
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

/**
 * Ids that exist without being stored.
 *
 * The built-in "Unlock by default" node is real and selectable but is not in the
 * config, so a structure pointing at it would otherwise look like a broken
 * reference. Worse, `edgeCounts` suppresses dangling reports when the target
 * category has no entries at all — a guard that is right for categories whose
 * targets live in the *game* (a config with no items is not a config with bad
 * item ids), and wrong here, where the category can be empty and the link still
 * perfectly valid. Listing the virtual id keeps that guard's meaning intact while
 * letting both cases be told apart.
 */
const VIRTUAL_IDS: Partial<Record<Tab, string[]>> = {
    unlockNodes: [DEFAULT_UNLOCK_NODE],
};

/** Count of live references along one edge, and how many of them dangle. */
function edgeCounts(
    cfg: Record<string, unknown>,
    from: Tab,
    field: string,
    to: Tab,
): { live: number; dangling: number } {
    const list = entriesOf(cfg, from);
    if (list.length === 0) return { live: 0, dangling: 0 };
    const known = new Set([
        ...(VIRTUAL_IDS[to] ?? []),
        ...entriesOf(cfg, to).map((e) => String(e.id ?? "")),
    ]);
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
 * How deep each kind sits in the dependency chain.
 *
 * Depth 0 is a kind that references nothing. Everything else is one more than
 * the deepest thing *it* references, so a box always draws below everything it
 * can point at. That is the property the top-down layout exists to guarantee:
 * you read the row and you already know what it can reach.
 *
 * **Cycles are real here** — `techs` requires other `techs`, and through items
 * and terrains back round again — so this is a longest path over the graph's
 * *condensation*, not over the raw edges. Every kind in a strongly connected
 * component is mutually reachable, and there is no honest depth that separates
 * them, so they share one and are laid out side by side in the same row. That is
 * the truthful answer: they depend on each other, so none is above another.
 *
 * The first version just stopped recursing when it met a cycle, which quietly
 * poisoned every depth on the path into it — `terrains` came out *above* the
 * `items` it points at, which is precisely the lie this layout must not tell.
 * The test "a box is always below what it references" is what caught it.
 */
function depthOf(cats: Tab[]): Map<Tab, number> {
    const index = new Map(cats.map((c, i) => [c, i]));
    const edges = new Map<Tab, number[]>();
    for (const c of cats) {
        edges.set(
            c,
            [...new Set(RELATIONS.filter((r) => r.from === c).map((r) => r.to))]
                .map((t) => index.get(t))
                .filter((i): i is number => i !== undefined)
                .filter((i) => cats[i] !== c),
        );
    }

    // Tarjan's strongly connected components, iteratively. An explicit stack
    // rather than recursion: this walks a real cycle, and a recursive version
    // would be one more thing to blow the stack on.
    const strong = new Int32Array(cats.length).fill(-1);
    const low = new Int32Array(cats.length);
    const onStack = new Uint8Array(cats.length);
    const stack: number[] = [];
    let next = 0;

    for (let root = 0; root < cats.length; root++) {
        if (strong[root] !== -1) continue;
        const work: { v: number; edge: number }[] = [{ v: root, edge: 0 }];
        while (work.length) {
            const frame = work[work.length - 1];
            const v = frame.v;
            const out = edges.get(cats[v]) ?? [];
            if (frame.edge === 0) {
                strong[v] = low[v] = next++;
                stack.push(v);
                onStack[v] = 1;
            }
            if (frame.edge < out.length) {
                const w = out[frame.edge++];
                if (strong[w] === -1) work.push({ v: w, edge: 0 });
                else if (onStack[w]) low[v] = Math.min(low[v], strong[w]);
            } else {
                if (low[v] === strong[v]) {
                    for (;;) {
                        const w = stack.pop() as number;
                        onStack[w] = 0;
                        strong[w] = strong[v];
                        if (w === v) break;
                    }
                }
                work.pop();
                if (work.length) {
                    const parent = work[work.length - 1].v;
                    low[parent] = Math.min(low[parent], low[v]);
                }
            }
        }
    }

    // Condense: one node per component, with the edges between them. The result
    // is a DAG by construction, which is what makes the walk below terminate.
    const compOf = (v: number) => strong[v];
    const compEdges = new Map<number, Set<number>>();
    for (let v = 0; v < cats.length; v++) {
        for (const w of edges.get(cats[v]) ?? []) {
            if (compOf(v) === compOf(w)) continue; // inside a cycle — not an edge
            const from = compOf(v);
            compEdges.set(from, (compEdges.get(from) ?? new Set()).add(compOf(w)));
        }
    }

    const compDepth = new Map<number, number>();
    const walk = (c: number): number => {
        const known = compDepth.get(c);
        if (known !== undefined) return known;
        compDepth.set(c, 0); // a guard; the condensation cannot cycle
        let d = 0;
        for (const t of compEdges.get(c) ?? []) d = Math.max(d, walk(t) + 1);
        compDepth.set(c, d);
        return d;
    };
    for (const c of new Set([...strong])) walk(c);

    const out = new Map<Tab, number>();
    for (let v = 0; v < cats.length; v++) out.set(cats[v], compDepth.get(compOf(v)) ?? 0);
    return out;
}

/**
 * Build the layout: one horizontal row per menu group.
 *
 * **Columns are depth.** A kind sits to the right of everything it references, so
 * an arrow runs right-to-left, and reading the picture left to right is reading it
 * in dependency order — what can be built from nothing, then what needs that, then
 * what needs that.
 *
 * **Rows are the menu's groups**, ordered by the shallowest kind each one contains.
 * That ordering is what keeps the two axes from fighting: the groups that only
 * feed the graph come first, and a group that purely consumes sits below what it
 * consumes, so most arrows are short and forward-leaning rather than criss-crossing
 * the whole width. It also gives the group names room to be read, which a column
 * layout could not: a vertical strip one box high has nowhere to put a long name.
 *
 * A kind the menu does not list gets a row of its own rather than being dropped,
 * because losing a node hides a real relation.
 *
 * The shape is fixed with respect to the *config*, not to the filter: a node never
 * moves because an unrelated entry was added, because a picture you cannot aim
 * at is not a picture. Changing the filter does re-flow, deliberately — see the
 * note on `keep` below.
 */
export function buildGraph(cfg: Record<string, unknown>, keep?: Set<Tab> | null): Graph {
    // The filter is applied *before* the layout, not after it.
    //
    // Filtering the finished graph hides boxes but leaves the gaps, so a
    // neighbourhood of five kinds sits in one corner of a diagram sized for
    // sixteen, with most of the panel empty. Re-flowing instead means the shown
    // kinds spread out to fill what is there — which also re-derives their
    // depths, so a kind's column reflects only the references actually on screen.
    //
    // That does trade away one thing: a node moves when you change the filter, so
    // you lose your place on the diagram. The trade is worth it because the whole
    // point of filtering is to look at a few kinds properly, and a handful of
    // boxes marooned in the corner is not looking at them properly.
    const cats = keep ? graphCategories().filter((c) => keep.has(c)) : graphCategories();
    if (!cats.length) {
        return { nodes: [], edges: [], columns: [], width: 0, height: 0, danglingRefs: [] };
    }
    const depth = depthOf(cats);

    const home = new Map<Tab, { key: string; label: string }>();
    for (const g of MENU_GROUPS) {
        for (const c of g.categories) home.set(c, { key: g.key, label: g.label });
    }
    const orphans = cats.filter((c) => !home.has(c));

    type Col = { key: string; label: string; cats: Tab[]; minDepth: number };
    const groups: Col[] = [];
    for (const g of MENU_GROUPS) {
        const members = cats.filter((c) => home.get(c)?.key === g.key);
        if (!members.length) continue;
        groups.push({
            key: g.key,
            label: g.label,
            cats: members,
            minDepth: Math.min(...members.map((c) => depth.get(c) ?? 0)),
        });
    }
    if (orphans.length) {
        groups.push({
            key: "__other",
            label: "Other",
            cats: orphans,
            minDepth: Math.min(...orphans.map((c) => depth.get(c) ?? 0)),
        });
    }
    // Shallowest group first. Ties keep the menu's own order, which `Array.sort`
    // is stable for, so the picture still reads top-to-bottom the way the menu
    // does rather than shuffling equal-depth groups around.
    groups.sort((a, b) => a.minDepth - b.minDepth);

    // Kinds at the same depth share a *slot* along the row rather than landing
    // on the same spot. Cycles put several kinds at one depth — terrains and
    // items, which reference each other — and without slots they would be drawn
    // on top of one another.
    //
    // The slot count is the same in *every* row, not per row. That is what keeps
    // "deeper means further right" true across the whole picture: if each row
    // sized its own slots, `recipes` at depth 2 in a sparse row could land to
    // the *left* of the `items` it points at in a full one, and a rightward
    // arrow would be pointing at something behind it.
    const perGroup = groups.map((g) => {
        const byDepth = new Map<number, Tab[]>();
        for (const cat of g.cats) {
            const d = depth.get(cat) ?? 0;
            byDepth.set(d, [...(byDepth.get(d) ?? []), cat]);
        }
        return byDepth;
    });
    const slot = Math.max(
        1,
        ...perGroup.flatMap((b) => [...b.values()].map((v) => v.length)),
    );
    const slotStep = NODE_W + COL_GAP;
    const rowHeight = slot * (NODE_H + ROW_GAP) - ROW_GAP;
    const groupHeight = HEAD_H + rowHeight;

    const nodes: GraphNode[] = [];
    const columns: GraphColumn[] = [];
    let widest = 0;

    groups.forEach((g, gi) => {
        const y = PAD + gi * (groupHeight + GROUP_GAP);
        const byDepth = perGroup[gi];
        let rightmost = 0;

        for (const [d, members] of byDepth) {
            for (let i = 0; i < members.length; i++) {
                const cat = members[i];
                const col = d * slot + i;
                widest = Math.max(widest, col);
                rightmost = Math.max(rightmost, col);
                nodes.push({
                    cat,
                    label: CATEGORY_META[cat].label,
                    group: g.key,
                    groupLabel: g.label,
                    depth: d,
                    count: entriesOf(cfg, cat).length,
                    x: PAD + HEAD_W + col * slotStep,
                    y: y + HEAD_H + i * (NODE_H + ROW_GAP),
                    w: NODE_W,
                    h: NODE_H,
                });
            }
        }

        columns.push({
            key: g.key,
            label: g.label,
            minDepth: g.minDepth,
            // A group is a *row*, so it reports its extent as one: a wide, shallow
            // band rather than a narrow, tall one.
            x: PAD,
            y,
            w: HEAD_W + (rightmost + 1) * slotStep - COL_GAP,
            h: groupHeight,
            count: g.cats.length,
        });
    });

    // Edges are cut to the same kinds as the nodes. Without this a filtered graph
    // keeps relations whose endpoints are not on it, and the arrow renderer draws
    // nothing for them — so `graph.edges` no longer matches what is visible, and
    // the relation table below the picture would list links to boxes that are not
    // there. The old post-hoc `filterGraph` did this; doing it here means the two
    // cannot disagree.
    const inGraph = new Set<Tab>(cats);
    const edges: GraphEdge[] = RELATIONS
        .filter((r) => inGraph.has(r.from) && inGraph.has(r.to))
        .map((r) => {
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

    return {
        nodes,
        edges,
        columns,
        width: PAD * 2 + HEAD_W + (widest + 1) * slotStep - COL_GAP,
        height: PAD * 2 + groups.length * groupHeight + Math.max(0, groups.length - 1) * GROUP_GAP,
        danglingRefs: findDangling(cfg),
    };
}

/**
 * The kinds directly connected to `cat`: what it points at, and what points at
 * it. Both directions, because "what can a Terrain point at" and "what points
 * at a Terrain" are the same question asked from two sides, and a filter that
 * only followed arrows one way would look like a bug in half the cases.
 */
export function neighboursOf(graph: Graph, cat: Tab): Set<Tab> {
    const out = new Set<Tab>([cat]);
    for (const e of graph.edges) {
        if (e.from === cat) out.add(e.to);
        if (e.to === cat) out.add(e.from);
    }
    return out;
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
