/**
 * Persistent JSON configuration store — all categories including contacts & interactions.
 */
import {
    type BufferEntryConfig,
    type ContactReactionConfig,
    DEFAULT_CONFIG,
    type ElementConfig,
    type EnergyNetworkConfig,
    type EnergyTypeConfig,
    type ExcavationProfileConfig,
    type InputBindingConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    type ModConfig,
    type ModifierConfig,
    type PanelState,
    type PlacementConfigConfig,
    type ProcessingConfig,
    type ProjectileConfig,
    type RecipeConfig,
    type SignalConfig,
    type SpriteConfig,
    type StructureBehaviorConfig,
    type StructureConfig,
    type TechConfig,
    type TerrainConfig,
    type TriggerConfig,
    type UnlockNodeConfig,
    type UpgradeCategoryConfig,
    type UpgradeConfig,
} from "../constants.ts";
import { api } from "../packages/mysandkit.ts";

// The migration below needs the derived-process id and the step shape, and only
// those two — importing the feature's barrel would drag the compiler in with it.
import { derivedProcessId } from "../handler/custom-process/registry.ts";
import type { ProcessStep } from "../handler/custom-process/types.ts";
import type { HandlerSlot } from "../handler/core/handler-registry.ts";
import { DEFAULT_UNLOCK_NODE } from "../ui/tech-link.ts";

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
        energyNetworks: Array.isArray(raw?.energyNetworks) ? raw!.energyNetworks! : [],
        unlockNodes: Array.isArray(raw?.unlockNodes) ? raw!.unlockNodes! : [],
        excavationProfiles: Array.isArray(raw?.excavationProfiles) ? raw!.excavationProfiles! : [],
        structureBehaviors: Array.isArray(raw?.structureBehaviors) ? raw!.structureBehaviors! : [],
        placementConfigs: Array.isArray(raw?.placementConfigs) ? raw!.placementConfigs! : [],
        signals: Array.isArray(raw?.signals) ? raw!.signals! : [],
        triggers: Array.isArray(raw?.triggers) ? raw!.triggers! : [],
        sprites: Array.isArray(raw?.sprites) ? raw!.sprites! : [],
        inputBindings: Array.isArray(raw?.inputBindings) ? raw!.inputBindings! : [],
        processes: Array.isArray(raw?.processes) ? raw!.processes! : [],
        // `buffers` is the one list that did not exist before this version, so a
        // stored config predating it has no key at all. `Array.isArray` is false
        // for `undefined`, which is exactly the "absent" answer wanted here.
        buffers: Array.isArray(raw?.buffers) ? raw!.buffers! : [],
    };
}

/**
 * The definitions that hold a legacy `actions` array, and the slot each sits in.
 *
 * Written out rather than derived from `SLOTS_BY_CATEGORY`, because the migration
 * needs the **reverse** direction of a table the handler registry owns — and importing
 * that here would pull the whole action catalogue into the config loader, which runs
 * before any of it is meant to. A test checks this list against the registry's
 * `SLOT_LOCATION`, so the two cannot drift silently.
 */
const LEGACY_SLOTS: readonly [string, HandlerSlot][] = [
    ["signals", "signal"],
    ["triggers", "trigger"],
    ["processing", "processing"],
    ["upgrades", "upgrade"],
    ["modifiers", "modifier"],
    ["items", "itemAction"],
];

/**
 * Convert a definition's legacy `actions` array into a referenced process.
 *
 * **Why this exists.** A definition used to store its program inline:
 * `actions: [{ key, options }]`. It now stores `processId` (D5, D6). Rather than
 * dropping the old data, each array becomes a **derived** process — id
 * `<entryId>#process` — and the entry is rewritten to reference it. Nothing the author
 * wrote is lost, and the behaviour is identical, because a derived process's steps
 * *are* that array.
 *
 * ## The three rules
 *
 * 1. **Only for an entry that has no `processId`.** An entry that already references
 *    something is left completely alone — its `actions` is stale data from an earlier
 *    save, and overwriting the reference would be the destructive choice.
 * 2. **Only for a non-empty array.** An entry with `actions: []` is a definition with
 *    no program, which is a legitimate state, and inventing a process for it would
 *    give the panel a row that does nothing.
 * 3. **One derived process per entry, never shared.** The id carries the entry id, so
 *    two entries cannot collide — and if they did, deleting one definition would
 *    silently change another's behaviour.
 *
 * ## Idempotence
 *
 * Running this twice must change nothing the second time, because `loadConfig` runs on
 * every boot. The first run gives the entry a `processId` and drops its `actions`, so
 * rule 1 excludes it from the second.
 */
export function migrateLegacyActions(
    cfg: ModConfig,
): { changed: number; config: ModConfig } {
    const out: ModConfig = { ...cfg, processes: [...(cfg.processes ?? [])] };
    const known = new Set(out.processes.map((p) => p.id));
    let changed = 0;

    for (const [category, slot] of LEGACY_SLOTS) {
        const entries = out[category as keyof ModConfig] as unknown;
        if (!Array.isArray(entries)) continue;
        // The list is copied before any entry is touched, and each entry is copied
        // **only if it changes**. A shallow `{ ...cfg }` is not enough: the entries are
        // the same objects, so writing `processId` through one would edit the caller's
        // config — and the caller's config can be `DEFAULT_CONFIG`, a module-level
        // singleton every other call shares. One migrated test would then leave every
        // later test seeing a half-migrated default.
        const list = entries as unknown[];
        let copied = false;
        for (let i = 0; i < list.length; i++) {
            const original = list[i] as Record<string, unknown> | null;
            if (!original || typeof original !== "object") continue;
            // Rule 1: already references something — leave it entirely alone.
            if (typeof original.processId === "string" && original.processId) continue;
            // Rule 2: an empty array is "no program", not "a program that is empty".
            if (!Array.isArray(original.actions) || original.actions.length === 0) continue;

            const entryId = String(original.id ?? "");
            if (!entryId) continue;
            const processId = derivedProcessId(entryId);
            // Rule 3: never overwrite an existing process, even on an id collision.
            if (known.has(processId)) continue;

            const steps = original.actions
                .filter((a) =>
                    a && typeof a === "object" && typeof (a as { key?: unknown }).key === "string"
                )
                .map((a) => {
                    const step = { key: String((a as { key: unknown }).key) } as ProcessStep;
                    const options = (a as { options?: unknown }).options;
                    if (options && typeof options === "object") {
                        step.options = options as Record<string, unknown>;
                    }
                    return step;
                });
            if (steps.length === 0) continue;

            out.processes.push({
                id: processId,
                scope: slot,
                steps,
                derived: true,
                derivedFrom: entryId,
            });
            known.add(processId);

            // Copy-on-write, and the copy is **assigned back to `out`** rather than
            // spliced in place. Splicing would have been the obvious thing and is
            // wrong: `out[category]` is the caller's own array, so a splice is a
            // mutation of it.
            if (!copied) {
                out[category as keyof ModConfig] = [...list] as never;
                copied = true;
            }
            const next: Record<string, unknown> = { ...original, processId };
            delete next.actions;
            (out[category as keyof ModConfig] as unknown as Record<string, unknown>[])[i] = next;
            changed++;
        }
    }
    return { changed, config: out };
}

export function loadConfig(): ModConfig {
    api.storage.ensure();
    // The migration is applied on **load**, not on save, so a config written by any
    // build of the mod is converted exactly once and every reader — the panel, the
    // register path, the usage scan — sees the same shape.
    return migrateLegacyActions(
        ensureArrays(api.storage.get<Partial<ModConfig>>(CONFIG_KEY)),
    ).config;
}

function saveConfig(cfg: ModConfig): void {
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

export function addOrUpdateEnergyNetwork(entry: EnergyNetworkConfig): ModConfig {
    const cfg = loadConfig();
    cfg.energyNetworks = upsert(cfg.energyNetworks, entry);
    saveConfig(cfg);
    return cfg;
}
export function addOrUpdateUnlockNode(entry: UnlockNodeConfig): ModConfig {
    const cfg = loadConfig();
    cfg.unlockNodes = upsert(cfg.unlockNodes, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeUnlockNode(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.unlockNodes = removeById(cfg.unlockNodes, id);
    // Structures pointed at the deleted node are moved to the built-in default
    // rather than left dangling: a dangling link reads as *unlocked* at apply
    // time, so the structures would silently jump from "needs research" to
    // "available immediately" while the panel still claimed they were gated.
    cfg.structures = (cfg.structures ?? []).map((s) =>
        s?.unlockNode === id ? { ...s, unlockNode: DEFAULT_UNLOCK_NODE } : s
    );
    saveConfig(cfg);
    return cfg;
}
export function removeEnergyNetwork(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.energyNetworks = removeById(cfg.energyNetworks, id);
    saveConfig(cfg);
    return cfg;
}

/**
 * Save a buffer slot, or replace the one with the same id.
 *
 * The two are the same operation on purpose. A slot is addressed by `id` in the
 * config and by `path` at runtime, and an author editing bounds or a default has
 * to be able to do it without thinking about which of the two they are changing —
 * so this matches on `id`, exactly like every other list in this store.
 */
export function addOrUpdateBufferEntry(entry: BufferEntryConfig): ModConfig {
    const cfg = loadConfig();
    cfg.buffers = upsert(cfg.buffers, entry);
    saveConfig(cfg);
    return cfg;
}

/**
 * Drop a buffer slot.
 *
 * Nothing is rewritten on the way out, and that is a deliberate difference from
 * `removeUnlockNode`. A node has referents in other lists, so deleting one has to
 * repoint them or they dangle. A slot has referents in *action options* — a
 * `bufferWrite` naming a path that no longer exists — and there is no honest
 * rewrite for those: the process is the author's, and silently deleting a step
 * from it would be a worse surprise than the step reading back its default.
 *
 * So a dangling `path` reads the slot's declared default, or the type's zero
 * when the slot is gone entirely. The write is dropped and reported, not
 * silently absorbed. See `problemFor` in the buffer store.
 */
export function removeBufferEntry(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.buffers = removeById(cfg.buffers, id);
    saveConfig(cfg);
    return cfg;
}

/**
 * Save one custom process, by id.
 *
 * `upsert`, like every other list here — a process is edited under the same id it was
 * created with, which is the whole point of the reference model: editing it changes
 * every definition that names it rather than creating a second one.
 */
export function addOrUpdateCustomProcess(
    entry: import("../handler/custom-process/types.ts").CustomProcessConfig,
): ModConfig {
    const cfg = loadConfig();
    cfg.processes = upsert(cfg.processes, entry);
    saveConfig(cfg);
    return cfg;
}

/**
 * Delete one process, and **un-reference** it.
 *
 * A definition left naming a deleted process would fail to compile on the next boot
 * and register as a machine that does nothing — a silent breakage caused by editing a
 * different screen. So every definition pointing at it has the key removed, and the
 * entry is left as a machine with no program, which is a real state the panel already
 * knows how to show.
 *
 * The alternative — refusing the delete while anything uses it — would make a process
 * undeletable until its author went and unhooked it from six screens, which is the
 * wrong trade for a config editor.
 */
export function removeCustomProcess(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.processes = removeById(cfg.processes, id);
    for (const [category] of LEGACY_SLOTS) {
        const entries = cfg[category as keyof ModConfig] as unknown;
        if (!Array.isArray(entries)) continue;
        for (const entry of entries as Record<string, unknown>[]) {
            if (entry?.processId === id) delete entry.processId;
        }
    }
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

export function addOrUpdateInputBinding(entry: InputBindingConfig): ModConfig {
    const cfg = loadConfig();
    cfg.inputBindings = upsert(cfg.inputBindings, entry);
    saveConfig(cfg);
    return cfg;
}
export function removeInputBinding(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.inputBindings = removeById(cfg.inputBindings, id);
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

export function addOrUpdatePlacementConfig(
    entry: PlacementConfigConfig,
): ModConfig {
    const cfg = loadConfig();
    cfg.placementConfigs = upsert(cfg.placementConfigs, entry);
    saveConfig(cfg);
    return cfg;
}
export function removePlacementConfig(id: string): ModConfig {
    const cfg = loadConfig();
    cfg.placementConfigs = removeById(cfg.placementConfigs, id);
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
