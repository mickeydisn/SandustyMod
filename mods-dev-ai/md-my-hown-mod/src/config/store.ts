import { LOG, type ModConfig, type PanelState } from "../constants.ts";
import { api } from "../packages/mysandkit.ts";
import type { HandlerSlot } from "../handler/core/handler-registry.ts";
import { DEFAULT_UNLOCK_NODE } from "../ui/tech-link.ts";

const CONFIG_KEY = "config";
const PANEL_KEY = "panel";

/** Every array-valued field of `ModConfig`. */
type CollectionKey = {
    [K in keyof ModConfig]: ModConfig[K] extends unknown[] ? K : never;
}[keyof ModConfig];

type CollectionEntry<K extends CollectionKey> = ModConfig[K] extends (infer E)[] ? E : never;

/**
 * Every id-keyed collection in `ModConfig`, with a short label for the save log.
 *
 * This table is the single source of truth: `ensureArrays` normalises exactly
 * these keys, and the `upsertIn`/`removeIn` helpers are written against them.
 * Adding a collection to `ModConfig` without adding it here is a type error.
 */
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

const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];

/** The collection keys that can hold a `processId` reference. */
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

/**
 * Side effects that must run when a collection entry is deleted. Declared next
 * to the collection they belong to instead of being buried in a bespoke
 * `removeX` function.
 */
const CASCADES: Partial<Record<CollectionKey, (cfg: ModConfig, id: string) => void>> = {
    /** Structures pointing at a deleted node fall back to the default node. */
    unlockNodes(cfg, id) {
        cfg.structures = (cfg.structures ?? []).map((s) =>
            s?.unlockNode === id ? { ...s, unlockNode: DEFAULT_UNLOCK_NODE } : s
        );
    },
    /** Entries referencing a deleted process drop the reference. */
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

/** Load, apply, save, return — the body shared by every mutation below. */
function mutate(apply: (cfg: ModConfig) => void): ModConfig {
    const cfg = loadConfig();
    apply(cfg);
    saveConfig(cfg);
    return cfg;
}

/** Insert or replace one entry in `key`, then persist. */
function upsertIn<K extends CollectionKey>(key: K, entry: CollectionEntry<K>): ModConfig {
    return mutate((cfg) => {
        const list = cfg[key] as { id: string }[];
        (cfg as Record<string, unknown>)[key] = upsert(list, entry as { id: string });
    });
}

/** Delete the entry with `id` from `key`, run its cascade, then persist. */
function removeIn(key: CollectionKey, id: string): ModConfig {
    return mutate((cfg) => {
        const list = cfg[key] as { id: string }[];
        (cfg as Record<string, unknown>)[key] = removeById(list, id);
        CASCADES[key]?.(cfg, id);
    });
}

/** Any config entry, as far as a runtime-resolved collection is concerned. */
type AnyEntry = { id: string } & Record<string, unknown>;

/**
 * Insert or replace an entry in a collection chosen at runtime.
 *
 * `upsertIn` is the strictly-typed path: it ties the entry to the collection, so
 * `upsertIn("elements", el)` rejects an `ItemConfig`. When the key is only known
 * at runtime that guarantee is unavailable, so this variant accepts any entry
 * carrying an `id` and stores it as-is. Callers are responsible for the shape.
 */
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

/**
 * The store, as one object.
 *
 * Mutations are addressed by collection key rather than by a named function
 * per collection, so adding a collection to `ModConfig` needs no new exports
 * here. Use `upsert` when the key is a literal (full type checking), or
 * `upsertAny` when the key is resolved at runtime, e.g. from a UI tab.
 */
export const configStore = {
    /** Read the config, normalised and migrated. */
    load: loadConfig,
    /** Persist a config object. */
    save: saveConfig,
    /** Serialise the config for download. */
    exportJson: exportConfigJson,
    /** Replace the config from parsed JSON. */
    importJson: importConfigJson,
    /** Read the saved panel window state. */
    loadPanel: loadPanelState,
    /** Persist the panel window state. */
    savePanel: savePanelState,
    /** Every collection key, with a short label for the save log. */
    collections: COLLECTIONS,
    /** Insert or replace one entry in a collection. */
    upsert: upsertIn,
    /** As `upsert`, for a collection key resolved at runtime. */
    upsertAny,
    /** Delete one entry from a collection, running its cascade. */
    remove: removeIn,
} as const;

/** The collection keys the config supports, e.g. `"elements"`, `"sprites"`. */
export type { CollectionKey };
