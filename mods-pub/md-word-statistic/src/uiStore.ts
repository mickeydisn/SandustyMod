/**
 * Panel UI preferences in mod storage (not configSchema).
 */
import { api, safe } from "./api.ts";
import { MOD_ID } from "./constants.ts";
import { loadCards } from "./cards.ts";
import {
    loadHistory,
    loadReference,
} from "./history.ts";
import { listCataloguesForPicker, resolveCards } from "./data.ts";
import type {
    ElementRow,
    HomeCardConfig,
    ScanSnapshot,
    StructureRow,
    TerrainRow,
} from "./types.ts";

export const UI_POS_KEY = "panelPosition";
export const UI_MINI_KEY = "panelMinimized";
export const UI_LOCK_KEY = "panelLocked";
export const UI_ZOOM_KEY = "panelZoom";
export const UI_ALPHA_KEY = "panelAlpha";
export const UI_AUTO_MIN_KEY = "panelAutoMinutes";

/** Right-anchored position (distance from viewport right / top). */
export interface PanelPos {
    right: number;
    top: number;
}

const DEFAULT_POS: PanelPos = { right: 16, top: 80 };

export function loadPanelPos(): PanelPos {
    const raw = safe(() => api.storage.get(MOD_ID, UI_POS_KEY));
    if (raw && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        // New shape
        if (typeof o.right === "number" && typeof o.top === "number") {
            return { right: o.right, top: o.top };
        }
        // Migrate old left/top → approximate right (assume ~40vw panel)
        if (typeof o.left === "number" && typeof o.top === "number" && o.left >= 0) {
            const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
            const right = Math.max(0, vw - o.left - vw * 0.4);
            return { right, top: o.top };
        }
    }
    return { ...DEFAULT_POS };
}

export function savePanelPos(pos: PanelPos): void {
    safe(() => api.storage.set(MOD_ID, UI_POS_KEY, pos));
}

export function loadMinimized(): boolean {
    return safe(() => api.storage.get(MOD_ID, UI_MINI_KEY)) === true;
}

export function saveMinimized(v: boolean): void {
    safe(() => api.storage.set(MOD_ID, UI_MINI_KEY, v));
}

export function loadLocked(): boolean {
    return safe(() => api.storage.get(MOD_ID, UI_LOCK_KEY)) === true;
}

export function saveLocked(v: boolean): void {
    safe(() => api.storage.set(MOD_ID, UI_LOCK_KEY, v));
}

/** Panel scale 0.6 – 1.4 (default 1). */
export function loadZoom(): number {
    const v = safe(() => api.storage.get(MOD_ID, UI_ZOOM_KEY));
    if (typeof v === "number" && Number.isFinite(v)) {
        return Math.min(1.4, Math.max(0.6, v));
    }
    return 1;
}

export function saveZoom(v: number): void {
    safe(() => api.storage.set(MOD_ID, UI_ZOOM_KEY, Math.min(1.4, Math.max(0.6, v))));
}

/** Opacity 0.35 – 1 (default 1). */
export function loadAlpha(): number {
    const v = safe(() => api.storage.get(MOD_ID, UI_ALPHA_KEY));
    if (typeof v === "number" && Number.isFinite(v)) {
        return Math.min(1, Math.max(0.35, v));
    }
    return 1;
}

export function saveAlpha(v: number): void {
    safe(() => api.storage.set(MOD_ID, UI_ALPHA_KEY, Math.min(1, Math.max(0.35, v))));
}

/** Panel override for auto-refresh interval minutes (1–20); null = use mod config. */
export function loadPanelAutoMinutes(): number | null {
    const v = safe(() => api.storage.get(MOD_ID, UI_AUTO_MIN_KEY));
    if (typeof v === "number" && Number.isFinite(v)) {
        return Math.min(20, Math.max(1, Math.round(v)));
    }
    return null;
}

export function savePanelAutoMinutes(v: number): void {
    safe(() => api.storage.set(MOD_ID, UI_AUTO_MIN_KEY, Math.min(20, Math.max(1, Math.round(v)))));
}

function mapToElementRows(m: Record<string, number>): ElementRow[] {
    const cats = listCataloguesForPicker().elements;
    const byId = new Map(cats.map((r) => [r.id.toLowerCase(), r]));
    const out: ElementRow[] = [];
    for (const [id, count] of Object.entries(m)) {
        const base = byId.get(id.toLowerCase());
        if (base) out.push({ ...base, count });
        else {
            out.push({
                type: -1, id, name: id, color: "#8a8a8a",
                mod: id.includes(":") ? id.split(":")[0]! : "(built-in)",
                builtin: !id.includes(":"), count,
            });
        }
    }
    return out.sort((a, b) => b.count - a.count);
}

function mapToStructureRows(m: Record<string, number>): StructureRow[] {
    const cats = listCataloguesForPicker().structures;
    const byId = new Map(cats.map((r) => [r.id.toLowerCase(), r]));
    const out: StructureRow[] = [];
    for (const [id, count] of Object.entries(m)) {
        const base = byId.get(id.toLowerCase());
        if (base) out.push({ ...base, count });
        else {
            out.push({
                id, name: id,
                mod: id.includes(":") ? id.split(":")[0]! : "(built-in)",
                category: "", builtin: !id.includes(":"), count,
            });
        }
    }
    return out.sort((a, b) => b.count - a.count);
}

function mapToTerrainRows(m: Record<string, number>): TerrainRow[] {
    const cats = listCataloguesForPicker().terrains;
    const byId = new Map(cats.map((r) => [r.id.toLowerCase(), r]));
    // also index by numeric type string and normalized name
    for (const r of cats) {
        byId.set(String(r.type), r);
        byId.set(r.name.toLowerCase(), r);
    }
    const out: TerrainRow[] = [];
    for (const [id, count] of Object.entries(m)) {
        const base = byId.get(id.toLowerCase()) ?? byId.get(id);
        if (base) {
            out.push({ ...base, count });
            continue;
        }
        // Try engine type-from-id
        const apiAny = (globalThis as any).sandkit?.api;
        let type = -1;
        let color = "#6a6a6a";
        let name = id;
        try {
            const t = apiAny?.terrains?.getTypeFromId?.(id) ?? apiAny?.terrains?.getTypeById?.(id);
            if (typeof t === "number") {
                type = t;
                const def = apiAny?.terrains?.getDefinitionByType?.(t) ?? {};
                name = def.name ?? def.nameKey ?? id;
                const mc = def.metaColor ?? def.color;
                if (typeof mc === "number") {
                    color = `#${(mc & 0xffffff).toString(16).padStart(6, "0")}`;
                }
            }
        } catch { /* */ }
        out.push({
            type, id, name: String(name), color,
            builtin: !id.includes(":"), count,
        });
    }
    return out.sort((a, b) => b.count - a.count);
}

export function hydrateFromStorage(cardConfigs?: HomeCardConfig[]): ScanSnapshot | null {
    const history = loadHistory();
    const reference = loadReference();
    const last = history.length > 0 ? history[history.length - 1]! : reference;
    if (!last) return null;

    const elements = mapToElementRows(last.elements);
    const structures = mapToStructureRows(last.structures);
    const terrains = mapToTerrainRows(last.terrains);

    const cats = listCataloguesForPicker();
    const elFull = cats.elements.map((r) => {
        const hit = elements.find((x) => x.id.toLowerCase() === r.id.toLowerCase());
        return hit ? { ...r, count: hit.count } : { ...r, count: 0 };
    });
    for (const r of elements) {
        if (!elFull.some((x) => x.id.toLowerCase() === r.id.toLowerCase())) elFull.push(r);
    }
    const stFull = cats.structures.map((r) => {
        const hit = structures.find((x) => x.id.toLowerCase() === r.id.toLowerCase());
        return hit ? { ...r, count: hit.count } : { ...r, count: 0 };
    });
    for (const r of structures) {
        if (!stFull.some((x) => x.id.toLowerCase() === r.id.toLowerCase())) stFull.push(r);
    }

    const configs = cardConfigs ?? loadCards();
    const cards = resolveCards(configs, elFull, stFull, terrains, reference, history);

    return {
        worldW: 0, worldH: 0, scannedCells: 0,
        authorizedCells: 0, skippedAuthCells: 0, durationMs: 0,
        at: last.at,
        elements, structures, terrains,
        totalElements: elements.reduce((s, r) => s + r.count, 0),
        totalStructures: structures.reduce((s, r) => s + r.count, 0),
        totalTerrains: terrains.reduce((s, r) => s + r.count, 0),
        emptyCells: 0, emptyPercent: 0, cards,
        statsReference: reference, statsHistory: history,
    };
}
