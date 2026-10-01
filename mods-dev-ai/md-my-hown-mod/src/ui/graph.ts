

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
    
    group: string;
    groupLabel: string;
    
    depth: number;
    
    count: number;
    x: number;
    y: number;
    w: number;
    h: number;
}


export interface GraphColumn {
    key: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    
    count: number;
    
    minDepth: number;
}

export interface GraphEdge {
    from: Tab;
    to: Tab;
    field: string;
    note: string;
    required: boolean;
    
    live: number;
    
    dangling: number;
}

export interface DanglingRef {
    
    from: Tab;
    
    fromId: string;
    field: string;
    
    target: string;
    to: Tab;
}

export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    
    columns: GraphColumn[];
    width: number;
    height: number;
    
    danglingRefs: DanglingRef[];
}

const NODE_W = 168;
const NODE_H = 44;

const HEAD_H = 26;

const COL_PAD = 8;

const ROW_GAP = 14;

const GROUP_GAP = 40;
const PAD = 16;


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


export function categoryColor(cat: Tab): string {
    const i = COLOUR_ORDER.indexOf(cat);
    
    
    return PALETTE[i < 0 ? COLOUR_ORDER.length % PALETTE.length : i % PALETTE.length];
}


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


const GAME_ID_LOADERS: Partial<Record<Tab, () => string[]>> = {
    elements: () => listElements({ includeHidden: true }).map((o) => o.value),
    items: () => listItems().map((o) => o.value),
    terrains: () => listTerrains().map((o) => o.value),
    structures: () => listStructures().map((o) => o.value),
    sprites: () => listSpriteIds().map((o) => o.value),
    techs: () => listTechIds().map((o) => o.value),
    
    
    
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


const VIRTUAL_IDS: Partial<Record<Tab, string[]>> = {
    unlockNodes: [DEFAULT_UNLOCK_NODE],
};


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

    
    
    const compOf = (v: number) => strong[v];
    const compEdges = new Map<number, Set<number>>();
    for (let v = 0; v < cats.length; v++) {
        for (const w of edges.get(cats[v]) ?? []) {
            if (compOf(v) === compOf(w)) continue; 
            const from = compOf(v);
            compEdges.set(from, (compEdges.get(from) ?? new Set()).add(compOf(w)));
        }
    }

    const compDepth = new Map<number, number>();
    const walk = (c: number): number => {
        const known = compDepth.get(c);
        if (known !== undefined) return known;
        compDepth.set(c, 0); 
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


export function buildGraph(cfg: Record<string, unknown>, keep?: Set<Tab> | null): Graph {
    
    
    
    
    
    
    
    
    
    
    
    
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
    
    
    
    
    
    groups.sort((a, b) => a.minDepth - b.minDepth);

    
    
    
    
    
    
    
    
    
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
    const slotStepH = NODE_H + ROW_GAP;
    
    
    
    
    const rows = Math.max(
        1,
        ...perGroup.flatMap((byDepth) =>
            [...byDepth].flatMap(([d, members]) => members.map((_, i) => d * slot + i + 1))
        ),
    );
    
    
    
    
    
    const groupW = NODE_W + COL_PAD * 2;
    const groupH = HEAD_H + rows * slotStepH - ROW_GAP;
    const nodeX = COL_PAD;

    const nodes: GraphNode[] = [];
    const columns: GraphColumn[] = [];

    groups.forEach((g, gi) => {
        const x = PAD + gi * (groupW + GROUP_GAP);
        const byDepth = perGroup[gi];

        for (const [d, members] of byDepth) {
            for (let i = 0; i < members.length; i++) {
                const cat = members[i];
                
                
                
                
                nodes.push({
                    cat,
                    label: CATEGORY_META[cat].label,
                    group: g.key,
                    groupLabel: g.label,
                    depth: d,
                    count: entriesOf(cfg, cat).length,
                    x: x + nodeX,
                    y: PAD + HEAD_H + (d * slot + i) * slotStepH,
                    w: NODE_W,
                    h: NODE_H,
                });
            }
        }

        columns.push({
            key: g.key,
            label: g.label,
            minDepth: g.minDepth,
            
            
            x,
            y: PAD,
            w: groupW,
            h: groupH,
            count: g.cats.length,
        });
    });

    
    
    
    
    
    
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
        width: PAD * 2 + groups.length * groupW + Math.max(0, groups.length - 1) * GROUP_GAP,
        height: PAD * 2 + groupH,
        danglingRefs: findDangling(cfg),
    };
}


export function neighboursOf(graph: Graph, cat: Tab): Set<Tab> {
    const out = new Set<Tab>([cat]);
    for (const e of graph.edges) {
        if (e.from === cat) out.add(e.to);
        if (e.to === cat) out.add(e.from);
    }
    return out;
}


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
