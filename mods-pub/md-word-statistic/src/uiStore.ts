/**
 * Mod-side panel store: the shared `@sandmd/ui` prefs store plus the
 * world-statistic snapshot hydration that rebuilds the panel from storage.
 */
import { createUiStore } from "@sandmd/ui";
import { MOD_ID } from "./constants.ts";
import { loadCards } from "./cards.ts";
import { loadHistory, loadReference } from "./history.ts";
import { listCataloguesForPicker, resolveCards } from "./data.ts";
import type {
    ElementRow,
    HomeCardConfig,
    ScanSnapshot,
    StructureRow,
    TerrainRow,
} from "./types.ts";

/** Position / zoom / opacity / lock / minimize / auto-refresh persistence. */
export const store = createUiStore({ modId: MOD_ID, keyPrefix: "panel" });

export const UI_POS_KEY = store.posKey;
export const UI_MINI_KEY = store.miniKey;
export const UI_LOCK_KEY = store.lockKey;
export const UI_ZOOM_KEY = store.zoomKey;
export const UI_ALPHA_KEY = store.alphaKey;
export const UI_AUTO_MIN_KEY = store.autoKey;

export const loadPanelPos = store.loadPanelPos;
export const savePanelPos = store.savePanelPos;
export const loadMinimized = store.loadMinimized;
export const saveMinimized = store.saveMinimized;
export const loadLocked = store.loadLocked;
export const saveLocked = store.saveLocked;
export const loadZoom = store.loadZoom;
export const saveZoom = store.saveZoom;
export const loadAlpha = store.loadAlpha;
export const saveAlpha = store.saveAlpha;
export const loadPanelAutoMinutes = store.loadAutoMinutes;
export const savePanelAutoMinutes = store.saveAutoMinutes;

function mapToElementRows(m: Record<string, number>): ElementRow[] {
    const cats = listCataloguesForPicker().elements;
    const byId = new Map(cats.map((r) => [r.id.toLowerCase(), r]));
    const out: ElementRow[] = [];
    for (const [id, count] of Object.entries(m)) {
        const base = byId.get(id.toLowerCase());
        if (base) out.push({ ...base, count });
        else {
            out.push({
                type: -1,
                id,
                name: id,
                color: "#8a8a8a",
                mod: id.includes(":") ? id.split(":")[0]! : "(built-in)",
                builtin: !id.includes(":"),
                count,
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
                id,
                name: id,
                mod: id.includes(":") ? id.split(":")[0]! : "(built-in)",
                category: "",
                builtin: !id.includes(":"),
                count,
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
            type,
            id,
            name: String(name),
            color,
            builtin: !id.includes(":"),
            count,
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
        worldW: 0,
        worldH: 0,
        scannedCells: 0,
        authorizedCells: 0,
        skippedAuthCells: 0,
        durationMs: 0,
        at: last.at,
        elements,
        structures,
        terrains,
        totalElements: elements.reduce((s, r) => s + r.count, 0),
        totalStructures: structures.reduce((s, r) => s + r.count, 0),
        totalTerrains: terrains.reduce((s, r) => s + r.count, 0),
        emptyCells: 0,
        emptyPercent: 0,
        cards,
        statsReference: reference,
        statsHistory: history,
    };
}
