import { LOG, type ModConfig, type PanelState } from "../constants.ts";
import { api } from "../packages/mysandkit.ts";
import type { HandlerSlot } from "../handler/index.ts";
import { DEFAULT_UNLOCK_NODE } from "../ui/tech-link.ts";

const CONFIG_KEY = "config";
const PANEL_KEY = "panel";

type CollectionKey = {
    [K in keyof ModConfig]: ModConfig[K] extends unknown[] ? K : never;
}[keyof ModConfig];

type CollectionEntry<K extends CollectionKey> = ModConfig[K] extends (infer E)[] ? E : never;

const COLLECTIONS = {
    elements: "el",
    structures: "st",
    items: "it",
    recipes: "re",
    processing: "pr",
    contacts: "ct",
    interactions: "ix",
    modifiers: "mod",
    terrains: "te",
    techs: "tech",
    upgradeCategories: "cat",
    upgrades: "up",
    projectiles: "pj",
    energyTypes: "et",
    energyNetworks: "en",
    unlockNodes: "un",
    excavationProfiles: "ex",
    structureBehaviors: "sb",
    placementConfigs: "pc",
    signals: "sig",
    triggers: "trg",
    sprites: "spr",
    inputBindings: "in",
    processes: "proc",
    buffers: "buf",
} as const satisfies Record<CollectionKey, string>;

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];

const PROCESS_REF_SLOTS: readonly [CollectionKey, HandlerSlot][] = [
    ["signals", "signal"],
    ["triggers", "trigger"],
    ["processing", "processing"],
    ["upgrades", "upgrade"],
    ["modifiers", "modifier"],
    ["items", "itemAction"],
];

function ensureArrays(raw: Partial<ModConfig> | null | undefined): ModConfig {
    const out = { version: typeof raw?.version === "number" ? raw.version : 1 } as ModConfig;
    const target = out as Record<string, unknown>;
    for (const key of COLLECTION_KEYS) {
        const value = raw?.[key];
        target[key] = Array.isArray(value) ? value : [];
    }
    return out;
}

const CASCADES: Partial<Record<CollectionKey, (cfg: ModConfig, id: string) => void>> = {
    unlockNodes(cfg, id) {
        cfg.structures = (cfg.structures ?? []).map((s) =>
            s?.unlockNode === id ? { ...s, unlockNode: DEFAULT_UNLOCK_NODE } : s
        );
    },

    processes(cfg, id) {
        for (const [category] of PROCESS_REF_SLOTS) {
            const entries = cfg[category] as unknown;
            if (!Array.isArray(entries)) continue;
            for (const entry of entries as Record<string, unknown>[]) {
                if (entry?.processId === id) delete entry.processId;
            }
        }
    },
};

function loadConfig(): ModConfig {
    api.storage.ensure();

    return ensureArrays(api.storage.get<Partial<ModConfig>>(CONFIG_KEY));
}

function saveConfig(cfg: ModConfig): void {
    const clean = JSON.parse(JSON.stringify(cfg, (_k, v) => {
        if (typeof v === "function") return undefined;
        return v;
    })) as ModConfig;
    api.storage.ensure();
    api.storage.set(CONFIG_KEY, clean);
    const counts = COLLECTION_KEYS
        .map((key) => `${COLLECTIONS[key]}:${(clean[key] as unknown[]).length}`)
        .join(" ");
    console.log(`${LOG} config saved (${counts})`);
}

function loadPanelState(defaultMinimized = true): PanelState {
    api.storage.ensure();
    const raw = api.storage.get<Partial<PanelState>>(PANEL_KEY);
    return {
        x: typeof raw?.x === "number" ? raw.x : -1,
        y: typeof raw?.y === "number" ? raw.y : -1,
        minimized: typeof raw?.minimized === "boolean" ? raw.minimized : defaultMinimized,
        width: typeof raw?.width === "number" ? raw.width : 440,
        height: typeof raw?.height === "number" ? raw.height : 560,
    };
}

function savePanelState(state: PanelState): void {
    api.storage.ensure();
    api.storage.set(PANEL_KEY, state);
}

function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
    const i = list.findIndex((e) => e.id === entry.id);
    if (i >= 0) {
        const next = list.slice();
        next[i] = entry;
        return next;
    }
    return [...list, entry];
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
    return list.filter((e) => e.id !== id);
}

function mutate(apply: (cfg: ModConfig) => void): ModConfig {
    const cfg = loadConfig();
    apply(cfg);
    saveConfig(cfg);
    return cfg;
}

function upsertIn<K extends CollectionKey>(key: K, entry: CollectionEntry<K>): ModConfig {
    return mutate((cfg) => {
        const list = cfg[key] as { id: string }[];
        (cfg as Record<string, unknown>)[key] = upsert(list, entry as { id: string });
    });
}

function removeIn(key: CollectionKey, id: string): ModConfig {
    return mutate((cfg) => {
        const list = cfg[key] as { id: string }[];
        (cfg as Record<string, unknown>)[key] = removeById(list, id);
        CASCADES[key]?.(cfg, id);
    });
}

type AnyEntry = { id: string } & Record<string, unknown>;

function upsertAny(key: CollectionKey, entry: AnyEntry): ModConfig {
    return mutate((cfg) => {
        const list = cfg[key] as AnyEntry[];
        (cfg as Record<string, unknown>)[key] = upsert(list, entry);
    });
}

function exportConfigJson(): string {
    return JSON.stringify(loadConfig(), null, 2);
}
function importConfigJson(json: string): ModConfig {
    const cfg = ensureArrays(JSON.parse(json) as Partial<ModConfig>);
    saveConfig(cfg);
    return cfg;
}

export const configStore = {
    load: loadConfig,

    save: saveConfig,

    exportJson: exportConfigJson,

    importJson: importConfigJson,

    loadPanel: loadPanelState,

    savePanel: savePanelState,

    collections: COLLECTIONS,

    upsert: upsertIn,

    upsertAny,

    remove: removeIn,
} as const;

export type { CollectionKey };
