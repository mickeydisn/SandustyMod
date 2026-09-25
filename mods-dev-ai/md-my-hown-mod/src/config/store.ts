/**
 * Persistent JSON configuration store — all categories including contacts & interactions.
 */
import {
    DEFAULT_CONFIG,
    LOG,
    type ModConfig,
    type ElementConfig,
    type StructureConfig,
    type ItemConfig,
    type RecipeConfig,
    type ProcessingConfig,
    type ContactReactionConfig,
    type InteractionConfig,
    type ModifierConfig,
    type TerrainConfig,
    type TechConfig,
    type UpgradeCategoryConfig,
    type UpgradeConfig,
    type ProjectileConfig,
    type EnergyTypeConfig,
    type ExcavationProfileConfig,
    type StructureBehaviorConfig,
    type SignalConfig,
    type TriggerConfig,
    type SpriteConfig,
    type PanelState,
} from "../constants.ts";
import { api } from "../packages/mysandkit.ts";

const CONFIG_KEY = "config";
const PANEL_KEY = "panel";

function ensureArrays(raw: Partial<ModConfig> | null | undefined): ModConfig {
    return {
        version: typeof raw?.version === "number" ? raw.version : 1,
        elements: Array.isArray(raw?.elements) ? raw!.elements! : [],
        structures: Array.isArray(raw?.structures) ? raw!.structures! : [],
        items: Array.isArray(raw?.items) ? raw!.items! : [],
        recipes: Array.isArray(raw?.recipes) ? raw!.recipes! : [],
        processing: Array.isArray(raw?.processing) ? raw!.processing! : [],
        contacts: Array.isArray(raw?.contacts) ? raw!.contacts! : [],
        interactions: Array.isArray(raw?.interactions) ? raw!.interactions! : [],
        modifiers: Array.isArray(raw?.modifiers) ? raw!.modifiers! : [],
        terrains: Array.isArray(raw?.terrains) ? raw!.terrains! : [],
        techs: Array.isArray(raw?.techs) ? raw!.techs! : [],
        upgradeCategories: Array.isArray(raw?.upgradeCategories) ? raw!.upgradeCategories! : [],
        upgrades: Array.isArray(raw?.upgrades) ? raw!.upgrades! : [],
        projectiles: Array.isArray(raw?.projectiles) ? raw!.projectiles! : [],
        energyTypes: Array.isArray(raw?.energyTypes) ? raw!.energyTypes! : [],
        excavationProfiles: Array.isArray(raw?.excavationProfiles) ? raw!.excavationProfiles! : [],
        structureBehaviors: Array.isArray(raw?.structureBehaviors) ? raw!.structureBehaviors! : [],
        signals: Array.isArray(raw?.signals) ? raw!.signals! : [],
        triggers: Array.isArray(raw?.triggers) ? raw!.triggers! : [],
        sprites: Array.isArray(raw?.sprites) ? raw!.sprites! : [],
    };
}

export function loadConfig(): ModConfig {
    api.storage.ensure();
    return ensureArrays(api.storage.get<Partial<ModConfig>>(CONFIG_KEY));
}

export function saveConfig(cfg: ModConfig): void {
    const clean = JSON.parse(JSON.stringify(cfg, (_k, v) => {
        if (typeof v === "function") return undefined;
        return v;
    })) as ModConfig;
    api.storage.ensure();
    api.storage.set(CONFIG_KEY, clean);
    console.log(
        `${LOG} config saved (el:${clean.elements.length} st:${clean.structures.length} it:${clean.items.length} re:${clean.recipes.length} pr:${clean.processing.length} ct:${clean.contacts.length} ix:${clean.interactions.length} mod:${clean.modifiers.length})`,
    );
}

export function loadPanelState(defaultMinimized = true): PanelState {
    api.storage.ensure();
    const raw = api.storage.get<Partial<PanelState>>(PANEL_KEY);
    return {
        x: typeof raw?.x === "number" ? raw.x : -1, // -1 => use right/bottom CSS
        y: typeof raw?.y === "number" ? raw.y : -1,
        minimized: typeof raw?.minimized === "boolean" ? raw.minimized : defaultMinimized,
        width: typeof raw?.width === "number" ? raw.width : 440,
        height: typeof raw?.height === "number" ? raw.height : 560,
    };
}

export function savePanelState(state: PanelState): void {
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

export function addOrUpdateElement(entry: ElementConfig): ModConfig {
    const cfg = loadConfig();
    cfg.elements = upsert(cfg.elements, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeElement(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.elements = removeById(cfg.elements, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateStructure(entry: StructureConfig): ModConfig {
    const cfg = loadConfig();
    cfg.structures = upsert(cfg.structures, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeStructure(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.structures = removeById(cfg.structures, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateItem(entry: ItemConfig): ModConfig {
    const cfg = loadConfig();
    cfg.items = upsert(cfg.items, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeItem(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.items = removeById(cfg.items, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateRecipe(entry: RecipeConfig): ModConfig {
    const cfg = loadConfig();
    cfg.recipes = upsert(cfg.recipes, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeRecipe(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.recipes = removeById(cfg.recipes, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateProcessing(entry: ProcessingConfig): ModConfig {
    const cfg = loadConfig();
    cfg.processing = upsert(cfg.processing, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeProcessing(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.processing = removeById(cfg.processing, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateContact(entry: ContactReactionConfig): ModConfig {
    const cfg = loadConfig();
    cfg.contacts = upsert(cfg.contacts, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeContact(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.contacts = removeById(cfg.contacts, id);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateInteraction(entry: InteractionConfig): ModConfig {
    const cfg = loadConfig();
    cfg.interactions = upsert(cfg.interactions, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeInteraction(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.interactions = removeById(cfg.interactions, id);
    saveConfig(cfg);
    return cfg;
}
export function replaceConfig(cfg: ModConfig): void {
    saveConfig(cfg);
}
export function exportConfigJson(): string {
    return JSON.stringify(loadConfig(), null, 2);
}
export function importConfigJson(json: string): ModConfig {
    const cfg = ensureArrays(JSON.parse(json) as Partial<ModConfig>);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateModifier(entry: ModifierConfig): ModConfig {
    const cfg = loadConfig();
    cfg.modifiers = upsert(cfg.modifiers, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeModifier(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.modifiers = removeById(cfg.modifiers, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateTerrain(entry: TerrainConfig): ModConfig {
    const cfg = loadConfig();
    cfg.terrains = upsert(cfg.terrains, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeTerrain(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.terrains = removeById(cfg.terrains, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateTech(entry: TechConfig): ModConfig {
    const cfg = loadConfig();
    cfg.techs = upsert(cfg.techs, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeTech(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.techs = removeById(cfg.techs, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateUpgradeCategory(entry: UpgradeCategoryConfig): ModConfig {
    const cfg = loadConfig();
    cfg.upgradeCategories = upsert(cfg.upgradeCategories, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeUpgradeCategory(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.upgradeCategories = removeById(cfg.upgradeCategories, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateUpgrade(entry: UpgradeConfig): ModConfig {
    const cfg = loadConfig();
    cfg.upgrades = upsert(cfg.upgrades, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeUpgrade(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.upgrades = removeById(cfg.upgrades, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateProjectile(entry: ProjectileConfig): ModConfig {
    const cfg = loadConfig();
    cfg.projectiles = upsert(cfg.projectiles, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeProjectile(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.projectiles = removeById(cfg.projectiles, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateEnergyType(entry: EnergyTypeConfig): ModConfig {
    const cfg = loadConfig();
    cfg.energyTypes = upsert(cfg.energyTypes, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeEnergyType(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.energyTypes = removeById(cfg.energyTypes, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateExcavationProfile(entry: ExcavationProfileConfig): ModConfig {
    const cfg = loadConfig();
    cfg.excavationProfiles = upsert(cfg.excavationProfiles, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeExcavationProfile(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.excavationProfiles = removeById(cfg.excavationProfiles, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateStructureBehavior(entry: StructureBehaviorConfig): ModConfig {
    const cfg = loadConfig();
    cfg.structureBehaviors = upsert(cfg.structureBehaviors, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeStructureBehavior(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.structureBehaviors = removeById(cfg.structureBehaviors, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateSignal(entry: SignalConfig): ModConfig {
    const cfg = loadConfig();
    cfg.signals = upsert(cfg.signals, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeSignal(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.signals = removeById(cfg.signals, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateTrigger(entry: TriggerConfig): ModConfig {
    const cfg = loadConfig();
    cfg.triggers = upsert(cfg.triggers, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeTrigger(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.triggers = removeById(cfg.triggers, id);
    saveConfig(cfg);
    return cfg;
}

export function addOrUpdateSprite(entry: SpriteConfig): ModConfig {
    const cfg = loadConfig();
    cfg.sprites = upsert(cfg.sprites, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeSprite(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.sprites = removeById(cfg.sprites, id);
    saveConfig(cfg);
    return cfg;
}
