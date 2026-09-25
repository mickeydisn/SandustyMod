/**
 * md-my-hown-mod — static configuration + FULL register field reference.
 *
 * Field lists are grounded in sandustry.dev API docs (v0.5.7) and the
 * mickeydisn structures-register tech note. Anything not listed can still be
 * passed via index signatures and is forwarded to the engine.
 */
import type { SettingsSchema } from "./packages/modkit.ts";

export const MOD_ID = "md-my-hown-mod";
export const VERSION = "0.1.4";
export const LOG = `[${MOD_ID}]`;

export const STORAGE_KEYS: readonly string[] = [
    "config",
    "panel",
] as const;

export const SETTINGS = {
    enabled: { type: "boolean", default: true },
    panelMinimized: { type: "boolean", default: false },
} as const satisfies SettingsSchema;

export const OVERLAY_ID = `${MOD_ID}:panel`;

/** Hotbar tool that opens the configurator (word-statistic pattern). */
export const ITEM_ID = `${MOD_ID}:tool`;
export const SPRITE_ID = `${MOD_ID}:icon`;
export const SPRITE_PATH = "assets/config-icon.png";
export const NAME_KEY = `mods|${MOD_ID}|tool|name`;
export const DESC_KEY = `mods|${MOD_ID}|tool|desc`;
export const TOOL_NAME = "My Own Mod";
export const TOOL_DESC =
    "<b>My Own Mod</b> — in-game content configurator.<br/>" +
    "Define elements, structures, items, recipes, processing, and more via JSON.<br/>" +
    "<span style=\"opacity:0.85\">Select this tool to open the panel.</span>";


// ═══════════════════════════════════════════════════════════════════════════
// MatterType (sandkit.enums.MatterType)
// Solid=1 Liquid=2 Particle=3 Gas=4 Static=5 Slushy=6 Wisp=7 Powder=8
// ═══════════════════════════════════════════════════════════════════════════

export type MatterTypeName =
    | "Solid" | "solid"
    | "Liquid" | "liquid"
    | "Particle" | "particle"
    | "Gas" | "gas"
    | "Static" | "static"
    | "Slushy" | "slushy"
    | "Wisp" | "wisp"
    | "Powder" | "powder";

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT — sandkit.api.elements.register(ElementDefinition)
// Docs: https://sandustry.dev/api/elements#register
// ═══════════════════════════════════════════════════════════════════════════

export interface ElementColorVariantFromData {
    rangeMin?: number;
    rangeMax?: number;
    invert?: boolean;
    useGradient?: boolean;
}

export interface ElementColors {
    /** Array of [r,g,b,a] tuples (0–255) */
    variants?: number[][];
    variantFromDataField1?: ElementColorVariantFromData;
}

export interface ElementDurationRandom {
    min: number;
    max: number;
}

/**
 * Full element definition accepted by elements.register.
 * Functions (getExtraProps) cannot live in JSON — use defaultDataFields instead
 * for serialisable configs; advanced users can still pass functions at runtime.
 */
export interface ElementConfig {
    /** Unique string id (required). Engine assigns numeric ElementType. */
    id: string;
    /** Display name (string or translatable). Auto-registers i18n when string. */
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    /**
     * Phase/behaviour class.
     * MatterType: Solid | Liquid | Particle | Gas | Static | Slushy | Wisp | Powder
     */
    matterType?: MatterTypeName | number;
    /** Simulation density (sink/float ordering). */
    density?: number;
    /** Packed 24-bit RGB integer (e.g. 0xff8ad4) for minimap / representative colour. */
    metaColor?: number;
    /** Numeric material id linking to a material shader/profile. */
    materialId?: number;
    /** Render colour scheme. */
    colors?: ElementColors | number[][];
    /** Base lifetime for transient elements (seconds). */
    duration?: number;
    durationRandom?: ElementDurationRandom;
    /** Can catch fire (boolean or richer object in some stock defs). */
    flammable?: boolean | Record<string, unknown>;
    isGrabbable?: boolean;
    isTransportable?: boolean;
    /** Hide from pickers / UI. */
    hidden?: boolean;
    /**
     * Interaction descriptors (tool reactions, growers, shakers, etc.).
     * Prefer elements.addInteractionInfo at runtime for complex cases.
     */
    interactions?: unknown[];
    /** Initial per-cell data field values, e.g. { field1: 20 }. */
    defaultDataFields?: Record<string, number | string | boolean>;
    /**
     * Callback returning extra per-cell props — NOT JSON-serialisable.
     * Omit from stored config; use only if injecting at runtime.
     */
    getExtraProps?: () => Record<string, unknown>;
    /** Passthrough for any future / undocumented engine fields. */
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE — sandkit.api.structures.register(StructureDefinition)
// Docs: https://sandustry.dev/api/structures#register
// Tech: doc/docs_tech/09-structures-register.md
// ═══════════════════════════════════════════════════════════════════════════

export interface StructureBuildMode {
    /**
     * single | singleDirectional | line | launcherRectUp | launcherRectSide |
     * rectangle | rectangleDirectional
     */
    type: string;
    /** For line-like modes: horizontal | vertical | diagonal */
    directions?: string[];
    [key: string]: unknown;
}

export interface StructureVariant {
    /** Structure type id for this facing */
    id: string;
    /** Degrees this variant matches (-180…180; diagonals allowed) */
    angles: number[];
}

export interface StructureRenderUi {
    size?: { width: number; height: number };
    width?: string;
    height?: string;
    offset?: { x: number; y: number };
    objectPosition?: string;
    clipToBounds?: boolean;
    imageName?: string;
}

export interface StructureRender {
    /** Sprite id from api.sprites.load / loadFromMod */
    imageName?: string;
    size?: { width: number; height: number };
    offset?: { x: number; y: number };
    ui?: StructureRenderUi;
    /** Animated spritesheet; frameBuffer.key must exist via workers.shared */
    spritesheet?: {
        frameBuffer?: { key: string; index?: number };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface StructureConfig {
    /** Unique structure type id (required). */
    id: string;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    /**
     * Build-menu category.
     * Known: blocks | logistics | production | economy | logic | fluids |
     * lighting | special | misc | thermal
     */
    categoryKey?: string;
    /** Sort order within category. */
    order?: number;
    alwaysUnlocked?: boolean;
    /** Id whose unlock also grants this one. */
    unlockedBy?: string;
    hideFromBuildMenu?: boolean;
    disallowPick?: boolean;
    /** Alias structure type for the block grid. */
    blockGridType?: string;
    /**
     * 2D footprint: array of rows; 1 = occupied (→ Block unless useRawShape).
     * Default 4×4 if omitted with no render.
     */
    shape?: number[][];
    /** Placement gesture modes. Default line horizontal if empty. */
    buildModes?: StructureBuildMode[];
    variants?: StructureVariant[];
    render?: StructureRender;
    /**
     * Custom canvas draw — NOT JSON-serialisable.
     * Strip before storage; inject only at runtime if needed.
     */
    draw?: (...args: unknown[]) => void;
    /** Default per-instance data (deep-cloned on register). */
    defaultData?: Record<string, unknown>;
    /** false → copier skips instance data (skipCopyData). Default true. */
    copyData?: boolean;
    /** Reject placement when shape overlaps existing cells. */
    rejectWhenBlocked?: boolean;
    altOriginOffsetY?: number;
    /** e.g. { type: "filter" } for hover inspector. */
    tooltipHover?: Record<string, unknown>;
    /**
     * Register options (second arg to structures.register).
     * useRawShape: keep shape cells as-is (no 1→Block normalisation).
     */
    registerOptions?: { useRawShape?: boolean };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM — sandkit.api.items.register(ItemDefinition)
// Docs: https://sandustry.dev/api/items#register
// ═══════════════════════════════════════════════════════════════════════════

export interface ItemSprite {
    /** Graphics key — must be loaded via sprites.load (required by engine). */
    id: string;
    /** backhand | twohand | onehand */
    type?: string;
    /** Named mount preset for pivot/offset. */
    mount?: string;
    [key: string]: unknown;
}

export interface ItemConfig {
    id: string;
    /** ItemType: Weapon | Tool | Consumable | Mod (defaults Mod). */
    itemType?: "Weapon" | "Tool" | "Consumable" | "Mod" | string | number;
    /** Alias some code paths use instead of itemType. */
    type?: string | number;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    categoryKey?: string;
    /** Required by engine — omitting sprite throws. */
    sprite?: ItemSprite;
    /** Per-use cooldown tracking when set. */
    cooldown?: number | { last?: number; [key: string]: unknown };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECIPE — structures.recipes.register + processing.register*
// Docs: https://sandustry.dev/api/structures#recipes-register
//       https://sandustry.dev/api/processing
// ═══════════════════════════════════════════════════════════════════════════

export type RecipeKind =
    | "grower"
    | "planterBox"
    | "shaker"
    | "kineticPress"
    | "condenser"
    | "steamDryer"
    | "synthesizer"
    | "snowmaker"
    | "smelter"
    | "structure"; // generic → structures.recipes.register(structureType, …)

export interface RecipeOutputEntry {
    elementType: string | number;
    chance?: number;
}

/**
 * Recipe body shared by processing.* and structures.recipes.register.
 * Element refs may be string ids (resolved via elements.getTypeFromId) or numbers.
 */
export interface RecipeConfig {
    id: string;
    /**
     * grower/planterBox → processing.registerGrower
     * shaker → processing.registerShaker
     * kineticPress → processing.registerKineticPress
     * condenser|steamDryer|synthesizer|snowmaker|smelter → structures.recipes.register(kind, …)
     * structure → structures.recipes.register(structureType, …)
     */
    kind: RecipeKind | string;
    /** Required when kind is "structure" or a custom structure type id. */
    structureType?: string | number;
    /** Element consumed. */
    input?: string | number;
    /** Single output (Grower-style). */
    output?: string | number;
    /** Probability 0–1 for single output (default 1). */
    chance?: number;
    /** Multi-output list. */
    outputs?: RecipeOutputEntry[];
    outputsAbove?: RecipeOutputEntry[];
    outputsBelow?: RecipeOutputEntry[];
    /** Gate recipe on incoming particle speed (Kinetic Press). */
    minimumDownwardVelocity?: number;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING — structures.processing.register / addProcessor
// Docs: https://sandustry.dev/api/structures#processing-register
// Note: `process` is a function → NOT JSON-serialisable.
// Stored config can hold intervalMs + structureType for documentation;
// real process callbacks must be injected by code extensions.
// ═══════════════════════════════════════════════════════════════════════════

export interface ProcessingConfig {
    id: string;
    /**
     * structureType (for processing.register) OR structure instance handle
     * (for addProcessor). Prefer string type id for config-driven use.
     */
    structureType?: string | number;
    structureId?: string | number;
    /** Interval between process ticks (ms). Must be finite > 0 for addProcessor. */
    intervalMs?: number;
    /**
     * process(ctx, api) — NOT JSON-serialisable.
     * Leave undefined in stored config; attach via code if needed.
     */
    process?: (ctx: unknown, api: unknown) => void;
    mode?: "type" | "instance"; // type → processing.register; instance → addProcessor
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT REACTION — reactions.registerContact
// Docs: https://sandustry.dev/api/reactions
// ═══════════════════════════════════════════════════════════════════════════

export interface ContactReactionConfig {
    id: string;
    /** First element in the contact pair (id or type). */
    inputA: string | number;
    /** Second element. */
    inputB: string | number;
    /** What inputA becomes, or null to remove. */
    outputA: string | number | null;
    /** What inputB becomes, or null to remove. */
    outputB: string | number | null;
    /** Optional orientation constraint. */
    orientation?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTION (elements.addInteractionInfo) — optional companion category
// ═══════════════════════════════════════════════════════════════════════════

export interface InteractionConfig {
    id: string;
    /** Element id/type to attach the interaction to. */
    elementId: string | number;
    /** Interaction descriptor (kind + payload). Shape varies by kind. */
    interaction: Record<string, unknown>;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN — terrains.register
// ═══════════════════════════════════════════════════════════════════════════

export interface TerrainConfig {
    id: string;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    displayNameOverrideKey?: string;
    hp?: number;
    materialId?: number;
    metaColor?: number;
    colorHSL?: number[];
    colorPattern?: { size?: number[]; colorsHSL?: number[][][] };
    colorGradient?: { stops?: Array<{ hp: number; color: unknown }> };
    output?: { elementType?: string | number | null; chance?: number };
    background?: Record<string, unknown>;
    backgroundElementType?: string | number;
    fog?: boolean;
    flammable?: boolean;
    excavationRequirements?: string[];
    interactions?: unknown[];
    noShadow?: boolean;
    isBuilding?: boolean;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// TECH — tech.registerDefinition / registerNode
// ═══════════════════════════════════════════════════════════════════════════

export interface TechConfig {
    id: string;
    name?: string;
    nameKey?: string;
    nameParams?: Record<string, unknown>;
    description?: string;
    descriptionKey?: string;
    descriptionParams?: Record<string, unknown>;
    cost?: number;
    currencyType?: string;
    branch?: string;
    requires?: string | string[];
    unlocks?: { structures?: string[]; items?: string[]; map?: boolean };
    icon?: { spriteName?: string; [key: string]: unknown };
    locked?: boolean;
    threshold?: number;
    radiusUnlockPx?: number;
    isElectricity?: boolean;
    electricityNodeStyle?: boolean;
    isAlien?: boolean;
    unavailable?: boolean;
    /** When set, also call tech.registerNode with placement. */
    parentId?: string;
    preferredPosition?: { row?: number; col?: number; [key: string]: unknown };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADES — upgrades.registerCategory / register
// onUpgrade is a function → use handlerKey into CODE_HANDLERS-style map
// ═══════════════════════════════════════════════════════════════════════════

export interface UpgradeCategoryConfig {
    id: string;
    categoryId: string;
    itemId?: string | number;
    itemName?: string;
    itemNameKey?: string;
    requirement?: Record<string, unknown>;
    upgrade?: Record<string, unknown>;
    /** handlerKey for onUpgrade callback (code-side). */
    onUpgradeKey?: string;
    [key: string]: unknown;
}

export interface UpgradeConfig {
    id: string;
    itemId: string | number;
    categoryId: string;
    itemName?: string;
    itemNameKey?: string;
    requirement?: Record<string, unknown>;
    upgrade: {
        id: string;
        nameKey?: string;
        descriptionKey?: string;
        maxLevel?: number;
        costs?: number[];
        oneOff?: boolean;
        [key: string]: unknown;
    };
    onUpgradeKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTILES — projectiles.register
// getOptions is a function → optionsJson stored; handlerKey can supply factory
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectileConfig {
    id: string;
    sprite: { id: string; tint?: number; [key: string]: unknown };
    /** Static options object used if no getOptionsKey. */
    options?: Record<string, unknown>;
    /** handlerKey returning options object (preferred for dynamic blueprints). */
    getOptionsKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY — energy.registerType(structureId, type, options)
// ═══════════════════════════════════════════════════════════════════════════

export interface EnergyTypeConfig {
    id: string;
    /** Structure / node id this energy type attaches to. */
    structureId: string;
    /** Behaviour class e.g. "storage". */
    type: string;
    options?: { priority?: number; excludeFromNetwork?: boolean; [key: string]: unknown };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCAVATION — excavation.registerProfile(id, definition)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExcavationProfileConfig {
    id: string;
    power: number;
    pattern: number[][];
    options?: {
        fromGun?: boolean;
        fromRocketExplosion?: boolean;
        fromDrill?: boolean;
        useLiteralOutVelocity?: boolean;
        destroyNonDestructible?: boolean;
        forceRemoveAll?: boolean;
        drillTierDamage?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE BEHAVIOURS — structureBehaviors (conveyor / launcher)
// Shape is loosely typed; forwarded as-is.
// ═══════════════════════════════════════════════════════════════════════════

export interface StructureBehaviorConfig {
    id: string;
    /** conveyor | launcher | other behaviour family */
    kind: string;
    behaviorType?: string;
    definition?: Record<string, unknown>;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNALS — targets / interactables / senderType (callbacks → handlerKey)
// ═══════════════════════════════════════════════════════════════════════════

export interface SignalConfig {
    id: string;
    /** targets | interactables | senderType */
    kind: "targets" | "interactables" | "senderType" | string;
    /** Target type name / structure type / sender type id. */
    target: string;
    handlerKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGERS — triggers.register (callback → handlerKey)
// ═══════════════════════════════════════════════════════════════════════════

export interface TriggerConfig {
    id: string;
    triggerId?: string;
    interval?: number;
    sequentialRuns?: number;
    extra?: Record<string, unknown>;
    handlerKey?: string;
    [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRITES — sprites.loadFromMod / load
// ═══════════════════════════════════════════════════════════════════════════

export interface SpriteConfig {
    id: string;
    /** Path relative to mod folder (loadFromMod). */
    path?: string;
    /** Absolute / arbitrary source for sprites.load. */
    source?: string;
    options?: Record<string, unknown>;
    /** Prefer loadFromMod when path is set. */
    fromMod?: boolean;
    [key: string]: unknown;
}


// ═══════════════════════════════════════════════════════════════════════════
// HOOKS / MODIFIERS — hooks.intercept + hooks.modify
// Docs: https://sandustry.dev/api/hooks
// Callbacks cannot live in JSON. Two modes:
//   1) handlerKey → resolved from CODE_HANDLERS registry in src/hooks/
//   2) metadata-only entry (applied only when a matching code handler exists)
// ═══════════════════════════════════════════════════════════════════════════

export type HookKind = "intercept" | "modify";

export interface ModifierConfig {
    id: string;
    /** Engine hook point name (string; official list is incomplete / version-dependent). */
    hookId: string;
    /** intercept = observe; modify = transform value flowing through. */
    kind: HookKind;
    /**
     * Key into the in-mod CODE_HANDLERS map (src/hooks/handlers.ts).
     * Required for a live callback. Without it the entry is stored but not attached.
     */
    handlerKey?: string;
    /** Passed as the 3rd argument to hooks.intercept / hooks.modify. */
    options?: Record<string, unknown>;
    /** Free-form notes for the UI / JSON authors. */
    notes?: string;
    /** If false, skip apply even when handlerKey resolves. Default true. */
    enabled?: boolean;
    [key: string]: unknown;
}

export type ModConfig = {
    version: number;
    elements: ElementConfig[];
    structures: StructureConfig[];
    items: ItemConfig[];
    recipes: RecipeConfig[];
    processing: ProcessingConfig[];
    contacts: ContactReactionConfig[];
    interactions: InteractionConfig[];
    modifiers: ModifierConfig[];
    terrains: TerrainConfig[];
    techs: TechConfig[];
    upgradeCategories: UpgradeCategoryConfig[];
    upgrades: UpgradeConfig[];
    projectiles: ProjectileConfig[];
    energyTypes: EnergyTypeConfig[];
    excavationProfiles: ExcavationProfileConfig[];
    structureBehaviors: StructureBehaviorConfig[];
    signals: SignalConfig[];
    triggers: TriggerConfig[];
    sprites: SpriteConfig[];
};

export const DEFAULT_CONFIG: ModConfig = {
    version: 1,
    elements: [],
    structures: [],
    items: [],
    recipes: [],
    processing: [],
    contacts: [],
    interactions: [],
    modifiers: [],
    terrains: [],
    techs: [],
    upgradeCategories: [],
    upgrades: [],
    projectiles: [],
    energyTypes: [],
    excavationProfiles: [],
    structureBehaviors: [],
    signals: [],
    triggers: [],
    sprites: [],
};

export type PanelState = {
    x: number;
    y: number;
    minimized: boolean;
    width?: number;
    height?: number;
};

/** Human-readable field help shown in the panel (JSON schema hints). */
export const FIELD_HELP = {
    elements: [
        "id (required)",
        "name, nameKey, description, descriptionKey",
        "matterType: Solid|Liquid|Particle|Gas|Static|Slushy|Wisp|Powder",
        "density, metaColor (0xRRGGBB), materialId",
        "colors: { variants: [[r,g,b,a],…] } or raw [[r,g,b,a],…]",
        "duration, durationRandom: {min,max}",
        "flammable, isGrabbable, isTransportable, hidden",
        "interactions[], defaultDataFields{}",
    ],
    structures: [
        "id (required)",
        "name, nameKey, description, descriptionKey",
        "categoryKey: blocks|logistics|production|economy|logic|fluids|lighting|special|misc",
        "order, alwaysUnlocked, unlockedBy, hideFromBuildMenu, disallowPick",
        "shape: number[][] (1=occupied)",
        "buildModes: [{type: single|line|rectangle|…, directions?}]",
        "variants: [{id, angles: number[]}]",
        "render: {imageName, size:{w,h}, offset?, ui?, spritesheet?}",
        "defaultData{}, copyData, rejectWhenBlocked, blockGridType",
        "registerOptions: {useRawShape?}",
    ],
    items: [
        "id (required)",
        "itemType: Weapon|Tool|Consumable|Mod",
        "name, nameKey, description, descriptionKey, categoryKey",
        "sprite: {id (required, must be loaded), type: onehand|twohand|backhand, mount?}",
        "cooldown",
    ],
    recipes: [
        "id (required)",
        "kind: grower|planterBox|shaker|kineticPress|condenser|steamDryer|synthesizer|snowmaker|smelter|structure",
        "structureType (when kind=structure or custom)",
        "input, output, chance (0–1)",
        "outputs / outputsAbove / outputsBelow: [{elementType, chance?}]",
        "minimumDownwardVelocity (kinetic press)",
    ],
    processing: [
        "id (required)",
        "structureType (processing.register) or structureId (addProcessor)",
        "intervalMs",
        "mode: type|instance",
        "NOTE: process() callback cannot be stored in JSON — attach in code",
    ],
    contacts: [
        "id (required)",
        "inputA, inputB (element ids/types)",
        "outputA, outputB (element ids/types or null to consume)",
        "orientation?",
    ],
    interactions: [
        "id (required)",
        "elementId (target element)",
        "interaction: { kind, … } descriptor for elements.addInteractionInfo",
    ],
    modifiers: [
        "id (required)",
        "hookId — engine hook point name (string)",
        "kind: intercept | modify",
        "handlerKey — key in src/hooks/handlers.ts CODE_HANDLERS (required for live attach)",
        "options — plain object passed to hooks.*",
        "enabled — default true",
        "notes — free text",
        "NOTE: real callbacks live in code (handlers.ts), not in JSON",
    ],
    terrains: [
        "id, name, hp, materialId, metaColor, colorHSL, colorPattern, colorGradient",
        "output: {elementType, chance}, fog, flammable, excavationRequirements[], background",
    ],
    techs: [
        "id, cost, currencyType, branch, requires, unlocks:{structures,items,map}",
        "parentId / preferredPosition for registerNode placement",
    ],
    upgradeCategories: ["categoryId, itemId, itemNameKey, onUpgradeKey"],
    upgrades: ["itemId, categoryId, upgrade:{id,maxLevel,costs,oneOff}, onUpgradeKey"],
    projectiles: ["id, sprite:{id,tint}, options or getOptionsKey"],
    energyTypes: ["id, structureId, type (e.g. storage), options:{priority,excludeFromNetwork}"],
    excavationProfiles: ["id, power, pattern (square number[][]), options flags"],
    structureBehaviors: ["id, kind (conveyor|launcher), definition{}"],
    signals: ["kind: targets|interactables|senderType, target, handlerKey"],
    triggers: ["triggerId, interval, sequentialRuns, extra, handlerKey"],
    sprites: ["id, path (loadFromMod) or source (load), options, fromMod"],

} as const;
