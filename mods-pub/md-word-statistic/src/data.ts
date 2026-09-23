/**
 * World statistic data: list registered definitions + count instances on the grid.
 *
 * Authorization: cells the player cannot interact with (auth denied) are skipped.
 * Home cards resolve per-item counts with tolerant id matching (vanilla ids are
 * often all-lowercase: water, gold, wetsand, liquidgold, …).
 */
import { api, root, safe } from "./api.ts";
import { BUILT_IN, SCAN_CHUNK } from "./constants.ts";
import { loadCards } from "./cards.ts";
import {
    buildRawSnapshot,
    CARD_GRAPH_POINTS,
    diffFromReference,
    loadHistory,
    loadReference,
    mapGet,
    recordRefresh,
    seriesForId,
} from "./history.ts";
import type {
    CardItemRef,
    CardItemStat,
    CardStat,
    ElementDefinition,
    ElementRow,
    HomeCardConfig,
    PickerOption,
    ScanSnapshot,
    StructureDefinition,
    StructureRow,
    TerrainDefinition,
    TerrainRow,
} from "./types.ts";

function ownerMod(id: string): string {
    const sep = id.indexOf(":");
    return sep > 0 ? id.slice(0, sep) : BUILT_IN;
}

function isBuiltinId(id: string): boolean {
    return id.indexOf(":") < 0;
}

function colorFromMeta(
    meta: number | string | undefined | null,
    fallback = "#8a8a8a",
): string {
    if (typeof meta === "string") {
        const s = meta.trim();
        if (/^#[0-9a-fA-F]{6,8}$/.test(s)) return s.length === 9 ? `#${s.slice(1, 7)}` : s;
        if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
        return fallback;
    }
    if (typeof meta !== "number" || !Number.isFinite(meta)) return fallback;
    // Engine often packs ARGB; keep RGB only
    const rgb = meta > 0xffffff ? (meta >>> 0) & 0xffffff : meta & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
}

/** Resolve terrain type → id / name / color from whatever the host exposes. */
function resolveTerrainMeta(type: number): { id: string; name: string; color: string } {
    const def = (safe(() => api.terrains.getDefinitionByType?.(type)) ?? {}) as TerrainDefinition & {
        colour?: number;
        displayName?: string;
    };
    const idRaw =
        safe(() => api.terrains.getIdByType?.(type)) ??
        safe(() => api.terrains.getIdFromType?.(type)) ??
        def.id ??
        null;
    const nameRaw =
        safe(() => api.terrains.getNameByType?.(type)) ??
        def.name ??
        def.displayName ??
        def.nameKey ??
        null;
    const colorRaw =
        def.metaColor ??
        def.color ??
        def.colour ??
        safe(() => api.terrains.getColorByType?.(type)) ??
        safe(() => api.terrains.getMetaColorByType?.(type));

    const id = idRaw != null && String(idRaw).trim() !== ""
        ? String(idRaw)
        : String(type);
    const name = nameRaw != null && String(nameRaw).trim() !== ""
        ? String(nameRaw)
        : id;
    const color = colorFromMeta(colorRaw as number | string | undefined, "#6a6a6a");
    return { id, name, color };
}

function listTerrainTypes(): number[] {
    const types = safe(() => api.terrains.getRegisteredTypes?.()) as number[] | null;
    if (Array.isArray(types) && types.length > 0) return types.filter((t) => typeof t === "number");
    // Fallback: probe a reasonable type range
    const found: number[] = [];
    for (let t = 0; t < 64; t++) {
        const id = safe(() => api.terrains.getIdByType?.(t) ?? api.terrains.getIdFromType?.(t));
        const def = safe(() => api.terrains.getDefinitionByType?.(t));
        if (id != null || (def && (def as TerrainDefinition).id)) found.push(t);
    }
    return found;
}


function worldSize(): { w: number; h: number } {
    const dims = safe(() => api.grid?.getDimensions?.() ?? api.world?.getDimensions?.());
    if (dims && typeof dims === "object") {
        const w = (dims as any).widthCells ?? (dims as any).width ?? 0;
        const h = (dims as any).heightCells ?? (dims as any).height ?? 0;
        if (w > 0 && h > 0) return { w, h };
    }
    return { w: 0, h: 0 };
}

function norm(id: string): string {
    return id.toLowerCase().replace(/[\s_\-:/]/g, "");
}

function canInteractAtCell(cx: number, cy: number): boolean {
    const auth = api.authorization;
    if (!auth) return true;
    let sawFalse = false;
    for (const fn of [
        () => auth.canGrabAtCell?.(cx, cy),
        () => auth.canBuildAtCell?.(cx, cy),
        () => auth.canUseToolAtCell?.(cx, cy),
    ]) {
        const v = safe(fn);
        if (v === false) sawFalse = true;
    }
    return !sawFalse;
}

export function listElementDefs(): ElementRow[] {
    const types = safe(() => api.elements.getRegisteredTypes(), []) ?? [];
    return types
        .map((t: number) => {
            const def = (safe(() => api.elements.getDefinitionByType(t)) ?? {}) as ElementDefinition;
            const id = def.id ?? String(t);
            const name =
                safe(() => api.elements.getNameByType?.(t)) ??
                def.name ??
                def.nameKey ??
                id;
            return {
                type: t,
                id,
                name: String(name),
                color: colorFromMeta(def.metaColor),
                mod: ownerMod(id),
                builtin: isBuiltinId(id),
                count: 0,
            };
        })
        .sort((a: ElementRow, b: ElementRow) => a.type - b.type);
}

export function listStructureDefs(): StructureRow[] {
    const rows = new Map<string, StructureRow>();
    const add = (id: string, def: StructureDefinition | null | undefined): void => {
        const d = def ?? {};
        const sid = typeof d.id === "string" ? d.id : id;
        if (!sid || rows.has(sid)) return;
        const name =
            d.name ??
            safe(() => api.i18n?.getName?.(d) ?? null) ??
            d.nameKey ??
            sid;
        rows.set(sid, {
            id: sid,
            name: String(name),
            mod: ownerMod(sid),
            category: d.categoryKey ?? "",
            builtin: isBuiltinId(sid),
            count: 0,
        });
    };
    const mods = root.mods?.structures ?? root.state?.sandkit?.mods?.structures;
    if (mods && typeof mods === "object") {
        for (const id of Object.keys(mods)) add(id, mods[id]);
    }
    const available = safe(() => api.structures.getAvailableTypes?.());
    if (Array.isArray(available)) {
        for (const ref of available) {
            const def = safe(() =>
                typeof ref === "number"
                    ? api.structures.getDefinitionByType?.(ref)
                    : api.structures.getDefinitionById?.(ref) ??
                        api.structures.getDefinitionByType?.(
                            api.structures.getTypeById?.(ref) ??
                                api.structures.getTypeFromId?.(ref),
                        )
            ) as StructureDefinition | null;
            const id = typeof ref === "string" ? ref : (def?.id ?? String(ref));
            add(id, def);
        }
    }
    return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function listPickerOptions(
    elements: ElementRow[],
    structures: StructureRow[],
    terrains: TerrainRow[],
): PickerOption[] {
    const out: PickerOption[] = [];
    for (const r of elements) {
        out.push({ kind: "element", id: r.id, label: `${r.name} (${r.id})`, color: r.color });
    }
    for (const r of terrains) {
        out.push({ kind: "terrain", id: r.id, label: `${r.name} (${r.id})`, color: r.color });
    }
    for (const r of structures) {
        out.push({ kind: "structure", id: r.id, label: `${r.name || r.id} (${r.id})`, color: "#8ab4f8" });
    }
    return out;
}

function countStructures(defs: StructureRow[]): void {
    for (const row of defs) {
        let n = 0;
        safe(() => {
            api.structures.forEachOfType(row.id, (structure: { x?: number; y?: number }) => {
                const sx = structure?.x;
                const sy = structure?.y;
                if (typeof sx === "number" && typeof sy === "number") {
                    if (!canInteractAtCell(sx, sy)) return;
                }
                n += 1;
            });
            return true;
        });
        row.count = n;
    }
}

async function scanGrid(
    elementMap: Map<number, ElementRow>,
    terrainAccum: Map<number, number>,
    onProgress?: (done: number, total: number) => void,
): Promise<{ scanned: number; authorized: number; skipped: number; empty: number }> {
    const { w, h } = worldSize();
    if (w <= 0 || h <= 0) return { scanned: 0, authorized: 0, skipped: 0, empty: 0 };
    const total = w * h;
    let scanned = 0, authorized = 0, skipped = 0, empty = 0, x = 0, y = 0;
    await new Promise<void>((resolve) => {
        const step = (): void => {
            let budget = SCAN_CHUNK;
            while (budget-- > 0 && y < h) {
                scanned += 1;
                if (!canInteractAtCell(x, y)) {
                    skipped += 1;
                } else {
                    authorized += 1;
                    const elType = safe(() => api.elements.getTypeAtCell(x, y));
                    if (typeof elType === "number") {
                        const row = elementMap.get(elType);
                        if (row) row.count += 1;
                    }
                    const trType = safe(() => api.terrains.getTypeAtCell(x, y));
                    if (typeof trType === "number") {
                        terrainAccum.set(trType, (terrainAccum.get(trType) ?? 0) + 1);
                    }
                    const isEmpty = safe(() =>
                        api.world?.isCellEmptyAtCell?.(x, y) ?? api.grid?.isCellEmptyAtCell?.(x, y)
                    );
                    if (isEmpty === true) empty += 1;
                }
                x += 1;
                if (x >= w) { x = 0; y += 1; }
            }
            onProgress?.(scanned, total);
            if (y < h) {
                (globalThis.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 0)))(step);
            } else resolve();
        };
        step();
    });
    return { scanned, authorized, skipped, empty };
}

function buildTerrainRows(accum: Map<number, number>): TerrainRow[] {
    const rows: TerrainRow[] = [];
    for (const [type, count] of accum) {
        if (count <= 0) continue;
        const meta = resolveTerrainMeta(type);
        rows.push({
            type,
            id: meta.id,
            name: meta.name,
            color: meta.color,
            builtin: isBuiltinId(meta.id),
            count,
        });
    }
    return rows.sort((a, b) => b.count - a.count || a.type - b.type);
}

function expandAliases(id: string): string[] {
    const base = id.trim();
    const n = norm(base);
    const set = new Set<string>([base, n, base.toLowerCase()]);
    const known: Record<string, string[]> = {
        gold: ["gold", "Gold"],
        liquidgold: ["liquidgold", "liquidGold", "LiquidGold", "goldLiquid"],
        water: ["water", "Water"],
        sand: ["sand", "Sand"],
        wetsand: ["wetsand", "wetSand", "WetSand"],
        dirt: ["dirt", "Dirt"],
        steam: ["steam", "Steam"],
        lava: ["lava", "Lava"],
        fire: ["fire", "Fire"],
    };
    const extra = known[n];
    if (extra) for (const e of extra) set.add(e);
    return [...set];
}

function resolveItemStat(
    ref: CardItemRef,
    primary: boolean,
    elements: ElementRow[],
    structures: StructureRow[],
    terrains: TerrainRow[],
): CardItemStat {
    const target = norm(ref.id);
    let label = ref.id;
    let color = "#8a8a8a";
    let count = 0;

    if (ref.kind === "element") {
        for (const r of elements) {
            if (norm(r.id) === target || norm(r.name) === target) {
                count = r.count; label = r.name; color = r.color; break;
            }
        }
        if (count === 0) {
            for (const a of expandAliases(ref.id)) {
                const t = safe(() => api.elements.getTypeFromId?.(a) ?? api.elements.getTypeById?.(a));
                if (typeof t === "number") {
                    const row = elements.find((r) => r.type === t);
                    if (row) { count = row.count; label = row.name; color = row.color; break; }
                    const def = safe(() => api.elements.getDefinitionByType?.(t)) as ElementDefinition | null;
                    if (def) {
                        label = String(def.name ?? def.nameKey ?? def.id ?? ref.id);
                        color = colorFromMeta(def.metaColor, color);
                    }
                }
            }
        }
    } else if (ref.kind === "terrain") {
        let matchedId = ref.id;
        for (const r of terrains) {
            if (
                norm(r.id) === target
                || norm(r.name) === target
                || String(r.type) === ref.id.trim()
            ) {
                count = r.count;
                label = r.name;
                color = r.color;
                matchedId = r.id;
                break;
            }
        }
        if (count === 0) {
            for (const a of expandAliases(ref.id)) {
                const ty = safe(() => api.terrains.getTypeFromId?.(a) ?? api.terrains.getTypeById?.(a));
                if (typeof ty === "number") {
                    const row = terrains.find((r) => r.type === ty);
                    if (row) {
                        count = row.count;
                        label = row.name;
                        color = row.color;
                        matchedId = row.id;
                        break;
                    }
                    // Type exists on map but not in present list — still bind id/color
                    const meta = resolveTerrainMeta(ty);
                    label = meta.name;
                    color = meta.color;
                    matchedId = meta.id;
                }
            }
        }
        return {
            kind: ref.kind, id: matchedId, label: String(label), color, count, primary,
            delta: null, series: [],
        };
    } else {
        for (const r of structures) {
            if (norm(r.id) === target || norm(r.name) === target) {
                count = r.count; label = r.name || r.id; color = "#8ab4f8"; break;
            }
        }
    }
    return { kind: ref.kind, id: ref.id, label: String(label), color, count, primary, delta: null, series: [] };
}

function attachHistoryToItem(
    item: CardItemStat,
    reference: import("./types.ts").RawStatsSnapshot | null,
    history: import("./types.ts").RawStatsSnapshot[],
): CardItemStat {
    const kindKey = item.kind === "element" ? "elements"
        : item.kind === "terrain" ? "terrains" : "structures";
    const delta = diffFromReference(reference, item.count, kindKey, item.id);
    // Series for charts is built at render time via seriesForId (same path as list graphs).
    const series = seriesForId(history, kindKey, item.id, CARD_GRAPH_POINTS);
    return { ...item, delta, series };
}


export function resolveCards(
    configs: HomeCardConfig[],
    elements: ElementRow[],
    structures: StructureRow[],
    terrains: TerrainRow[],
    reference: import("./types.ts").RawStatsSnapshot | null = null,
    history: import("./types.ts").RawStatsSnapshot[] = [],
): CardStat[] {
    return configs.map((cfg) => {
        let items = cfg.items.map((ref, i) =>
            resolveItemStat(ref, i === 0, elements, structures, terrains)
        );
        items = items.map((it) => attachHistoryToItem(it, reference, history));
        const primary = items[0];
        const total = items.reduce((s, it) => s + it.count, 0);
        let delta: number | null = null;
        if (reference) {
            let refTotal = 0;
            for (const it of items) {
                const kindKey = it.kind === "element" ? "elements"
                    : it.kind === "terrain" ? "terrains" : "structures";
                refTotal += mapGet(reference[kindKey], it.id);
            }
            delta = total - refTotal;
        }
        return {
            id: cfg.id,
            title: cfg.title,
            color: primary?.color ?? "#ffe700",
            total,
            delta,
            items,
        };
    });
}

export async function runScan(
    onProgress?: (done: number, total: number) => void,
    cardConfigs?: HomeCardConfig[],
): Promise<ScanSnapshot> {
    const t0 = performance.now?.() ?? Date.now();
    const { w, h } = worldSize();

    const elementsAll = listElementDefs();
    const elementMap = new Map<number, ElementRow>();
    for (const r of elementsAll) elementMap.set(r.type, r);

    const structuresAll = listStructureDefs();
    countStructures(structuresAll);

    const terrainAccum = new Map<number, number>();
    const { scanned, authorized, skipped, empty } = await scanGrid(elementMap, terrainAccum, onProgress);
    const terrains = buildTerrainRows(terrainAccum);

    const elementsPresent = elementsAll.filter((r) => r.count > 0);
    const structuresPresent = structuresAll.filter((r) => r.count > 0);

    const totalElements = elementsPresent.reduce((s, r) => s + r.count, 0);
    const totalStructures = structuresPresent.reduce((s, r) => s + r.count, 0);
    const totalTerrains = terrains.reduce((s, r) => s + r.count, 0);

    elementsPresent.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    structuresPresent.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

    const emptyPercent = authorized > 0 ? (100 * empty) / authorized : 0;
    const configs = cardConfigs ?? loadCards();

    // Persist raw stats (reference once, history FIFO ≤20)
    const raw = buildRawSnapshot(elementsAll, terrains, structuresAll, Date.now());
    const { reference, history } = recordRefresh(raw);

    const cards = resolveCards(
        configs, elementsAll, structuresAll, terrains, reference, history,
    );

    const t1 = performance.now?.() ?? Date.now();
    return {
        worldW: w, worldH: h, scannedCells: scanned,
        authorizedCells: authorized, skippedAuthCells: skipped,
        durationMs: Math.round(t1 - t0), at: Date.now(),
        elements: elementsPresent, structures: structuresPresent, terrains,
        totalElements, totalStructures, totalTerrains,
        emptyCells: empty, emptyPercent, cards,
        statsReference: reference,
        statsHistory: history,
    };
}

export function listCataloguesForPicker(): {
    elements: ElementRow[];
    structures: StructureRow[];
    terrains: TerrainRow[];
} {
    const elements = listElementDefs();
    const structures = listStructureDefs();
    const terrains: TerrainRow[] = [];
    for (const type of listTerrainTypes()) {
        const meta = resolveTerrainMeta(type);
        terrains.push({
            type,
            id: meta.id,
            name: meta.name,
            color: meta.color,
            builtin: isBuiltinId(meta.id),
            count: 0,
        });
    }
    return { elements, structures, terrains };
}
