
import type { SettingsSchema } from "./packages/modkit.ts";



import type { CustomProcessConfig } from "./handler/processing/custom-process/types.ts";
export const MOD_ID = "md-my-hown-mod";
export const VERSION = "0.1.4";
export const LOG = `[${MOD_ID}]`;


export const OWN_ID_PREFIXES: readonly string[] = [MOD_ID, "mdmy"];

export const STORAGE_KEYS: readonly string[] = [
    "config",
    "panel",
] as const;

export const SETTINGS = {
    enabled: { type: "boolean", default: true },
    
    panelMinimized: { type: "boolean", default: true },
} as const satisfies SettingsSchema;


export function humanise(k: string): string {
    const spaced = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const OVERLAY_ID = `${MOD_ID}:panel`;


export const TOOL_NAME = "My Own Mod";






export type MatterTypeName =
    | "Solid"
    | "solid"
    | "Liquid"
    | "liquid"
    | "Particle"
    | "particle"
    | "Gas"
    | "gas"
    | "Static"
    | "static"
    | "Slushy"
    | "slushy"
    | "Wisp"
    | "wisp"
    | "Powder"
    | "powder";






export interface ElementColorVariantFromData {
    rangeMin?: number;
    rangeMax?: number;
    invert?: boolean;
    useGradient?: boolean;
}

export interface ElementColors {
    
    variants?: number[][];
    variantFromDataField1?: ElementColorVariantFromData;
}

export interface ElementDurationRandom {
    min: number;
    max: number;
}


export interface ElementConfig {
    
    id: string;
    
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    
    matterType?: MatterTypeName | number;
    
    density?: number;
    
    metaColor?: number;
    
    materialId?: number;
    
    colors?: ElementColors | number[][];
    
    duration?: number;
    durationRandom?: ElementDurationRandom;
    
    flammable?: boolean | Record<string, unknown>;
    isGrabbable?: boolean;
    isTransportable?: boolean;
    
    hidden?: boolean;
    
    interactions?: unknown[];
    
    defaultDataFields?: Record<string, number | string | boolean>;
    
    getExtraProps?: () => Record<string, unknown>;
    
    [key: string]: unknown;
}







export interface StructureBuildMode {
    
    type: string;
    
    directions?: string[];
    [key: string]: unknown;
}

export interface StructureVariant {
    
    id: string;
    
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
    
    imageName?: string;
    size?: { width: number; height: number };
    offset?: { x: number; y: number };
    ui?: StructureRenderUi;
    
    spritesheet?: {
        frameBuffer?: { key: string; index?: number };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface StructureConfig {
    
    id: string;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    
    categoryKey?: string;
    
    order?: number;
    
    hideFromBuildMenu?: boolean;
    
    alwaysUnlocked?: boolean;
    
    unlockNode?: string;
    disallowPick?: boolean;
    
    maxPlaced?: number;
    
    blockGridType?: string;
    
    shape?: number[][];
    
    buildModes?: StructureBuildMode[];
    variants?: StructureVariant[];
    render?: StructureRender;
    
    draw?: (...args: never[]) => boolean | void;
    
    drawKey?: string;
    
    defaultData?: Record<string, unknown>;
    
    copyData?: boolean;
    
    rejectWhenBlocked?: boolean;
    altOriginOffsetY?: number;
    
    tooltipHover?: Record<string, unknown>;
    
    registerOptions?: { useRawShape?: boolean };
    [key: string]: unknown;
}






export interface ItemSprite {
    
    id: string;
    
    type?: string;
    
    mount?: string;
    [key: string]: unknown;
}

export interface ItemConfig {
    id: string;
    
    itemType?: "Weapon" | "Tool" | "Consumable" | "Mod" | string | number;
    
    type?: string | number;
    name?: string;
    nameKey?: string;
    description?: string;
    descriptionKey?: string;
    categoryKey?: string;
    
    sprite?: ItemSprite;
    
    cooldown?: number | { last?: number; [key: string]: unknown };
    
    handlerKey?: string;
    
    hideFromBuildMenu?: boolean;
    [key: string]: unknown;
}


export type HiddenCategory = "elements" | "structures" | "items";


export const HIDDEN_FIELD: Partial<Record<HiddenCategory, string>> = {
    elements: "visibleInPicker",
    structures: "hideFromBuildMenu",
    items: "hideFromBuildMenu",
};


const HIDDEN_INVERTED: Partial<Record<HiddenCategory, boolean>> = {
    elements: true,
};


export function entryVisibility(
    e: Record<string, unknown>,
    cat: string,
): boolean | undefined {
    const field = HIDDEN_FIELD[cat as HiddenCategory];
    
    
    
    
    
    
    
    
    
    
    
    
    
    if (field && typeof e[field] === "boolean") {
        return HIDDEN_INVERTED[cat as HiddenCategory] ? e[field] === false : e[field] === true;
    }
    return undefined;
}


export function configIsHidden(e: Record<string, unknown>, cat: string): boolean {
    
    
    
    return entryVisibility(e, cat) === true;
}







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
    | "structure"; 

export interface RecipeOutputEntry {
    elementType: string | number;
    chance?: number;
}


export interface RecipeConfig {
    id: string;
    
    kind: RecipeKind | string;
    
    structureType?: string | number;
    
    input?: string | number;
    
    output?: string | number;
    
    chance?: number;
    
    outputs?: RecipeOutputEntry[];
    outputsAbove?: RecipeOutputEntry[];
    outputsBelow?: RecipeOutputEntry[];
    
    minimumDownwardVelocity?: number;
    [key: string]: unknown;
}









export interface ProcessingConfig {
    id: string;
    
    structureType?: string | number;
    
    intervalMs?: number;
    
    process?: (ctx: unknown, api: unknown) => void;
    [key: string]: unknown;
}






export interface ContactReactionConfig {
    id: string;
    
    inputA: string | number;
    
    inputB: string | number;
    
    outputA: string | number | null;
    
    outputB: string | number | null;
    
    orientation?: string;
    [key: string]: unknown;
}





export interface InteractionConfig {
    id: string;
    
    elementId: string | number;
    
    interaction: Record<string, unknown>;
    [key: string]: unknown;
}







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
    
    parentId?: string;
    preferredPosition?: { row?: number; col?: number; [key: string]: unknown };
    [key: string]: unknown;
}






export interface UpgradeCategoryConfig {
    id: string;
    
    name?: string;
    
    nameKey?: string;
    categoryId: string;
    itemId?: string | number;
    itemName?: string;
    itemNameKey?: string;
    requirement?: Record<string, unknown>;
    upgrade?: Record<string, unknown>;
    
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






export interface ProjectileConfig {
    id: string;
    sprite: { id: string; tint?: number; [key: string]: unknown };
    
    options?: Record<string, unknown>;
    
    getOptionsKey?: string;
    [key: string]: unknown;
}






export interface EnergyNetworkConfig {
    id: string;
    name?: string;
    [key: string]: unknown;
}


export interface UnlockNodeConfig {
    id: string;
    name?: string;
    description?: string;
    
    kind: "always" | "tech";
    
    cost?: number;
    currencyType?: string;
    branch?: string;
    
    parentId?: string;
    requires?: string[];
    
    techId?: string;
    [key: string]: unknown;
}


export type BufferValueType = "number" | "bool" | "string";


export interface BufferEntryConfig {
    id: string;
    
    path: string;
    type: BufferValueType;
    
    default: number | boolean | string;
    
    min?: number;
    max?: number;
    [key: string]: unknown;
}

export interface EnergyTypeConfig {
    id: string;
    
    structureId: string;
    
    type: "conductor" | "storage" | (string & {});
    
    options?: {
        capacity?: number;
        energyType?: string;
        priority?: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}





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
    
    terrainRules?: {
        cellType?: string | number;
        terrainType?: string | number;
        damage?: number;
        outputElementType?: string | number;
        [key: string]: unknown;
    }[];
    [key: string]: unknown;
}






export interface StructureBehaviorConfig {
    id: string;
    
    kind: string;
    behaviorType?: string;
    definition?: Record<string, unknown>;
    [key: string]: unknown;
}



























export interface PlacementFieldUpgradeMax {
    
    itemId: string;
    
    upgradeId: string;
    
    minimum?: number;
    
    offset?: number;
}

export interface PlacementFieldOptionConfig {
    
    value: string;
    
    label?: string;
    
    labelKey?: string;
    [key: string]: unknown;
}

export interface PlacementFieldConfig {
    
    type: "integer" | "choice";
    
    id: string;
    
    label?: string;
    
    labelKey?: string;
    
    min?: number;
    
    max?: number | PlacementFieldUpgradeMax;
    
    default?: number;
    
    options?: PlacementFieldOptionConfig[];
    [key: string]: unknown;
}

export interface PlacementConfigConfig {
    
    id: string;
    
    structureId: string;
    
    fields: PlacementFieldConfig[];
    [key: string]: unknown;
}





export interface SignalConfig {
    id: string;
    
    kind: "targets" | "interactables" | "senderType" | string;
    
    target: string;
    handlerKey?: string;
    [key: string]: unknown;
}














export interface InputBindingConfig {
    
    id: string;
    
    displayName: string;
    
    displayNameKey?: string;
    
    category: string;
    
    defaultKeys?: string[];
    
    onDownKey?: string;
    
    onUpKey?: string;
    
    subsection?: {
        title?: string;
        titleKey?: string;
        description?: string;
        descriptionKey?: string;
    };
    [key: string]: unknown;
}





export interface TriggerConfig {
    id: string;
    triggerId?: string;
    interval?: number;
    sequentialRuns?: number;
    extra?: Record<string, unknown>;
    handlerKey?: string;
    [key: string]: unknown;
}





export interface SpriteConfig {
    id: string;
    
    path?: string;
    
    source?: string;
    options?: Record<string, unknown>;
    
    fromMod?: boolean;
    [key: string]: unknown;
}









export type HookKind = "intercept" | "modify";

export interface ModifierConfig {
    id: string;
    
    hookId: string;
    
    kind: HookKind;
    
    handlerKey?: string;
    
    options?: Record<string, unknown>;
    
    notes?: string;
    
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
    energyNetworks: EnergyNetworkConfig[];
    
    unlockNodes: UnlockNodeConfig[];
    excavationProfiles: ExcavationProfileConfig[];
    structureBehaviors: StructureBehaviorConfig[];
    
    placementConfigs: PlacementConfigConfig[];
    signals: SignalConfig[];
    triggers: TriggerConfig[];
    sprites: SpriteConfig[];
    inputBindings: InputBindingConfig[];
    
    processes: CustomProcessConfig[];
    
    buffers: BufferEntryConfig[];
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
    energyNetworks: [],
    unlockNodes: [],
    excavationProfiles: [],
    structureBehaviors: [],
    placementConfigs: [],
    signals: [],
    triggers: [],
    sprites: [],
    processes: [],
    inputBindings: [],
    buffers: [],
};

export type PanelState = {
    x: number;
    y: number;
    minimized: boolean;
    width?: number;
    height?: number;
};


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
        "order, hideFromBuildMenu, disallowPick",
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
        "actions: [{key, options}] — the process, ordered",
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
    upgradeCategories: ["categoryId, itemId, itemNameKey, requirement:{techId}"],
    upgrades: ["itemId, categoryId, upgrade:{id,maxLevel,costs,oneOff}, actions: [{key, options}]"],
    projectiles: ["id, sprite:{id,tint}, options, option:{key, params}"],
    energyTypes: ["id, structureId, type (e.g. storage), options:{priority,excludeFromNetwork}"],
    excavationProfiles: ["id, power, pattern (square number[][]), options flags"],
    structureBehaviors: ["id, kind (conveyor|launcher), definition{}"],
    placementConfigs: [
        "id (required, mod-local)",
        "structureId (required) — the structure these fields belong to",
        "fields[] (required, non-empty) — {type: integer|choice, id, label|labelKey}",
        "  integer: min?, max? (number or {itemId, upgradeId, minimum?, offset?}), default?",
        "  choice: options[] (required, non-empty) — {value, label|labelKey}",
        "NOTE: a hotbar field list, NOT a cap on how many may be placed",
    ],
    signals: ["kind: targets|interactables|senderType, target, actions: [{key, options}]"],
    triggers: ["triggerId, interval, sequentialRuns, extra, actions: [{key, options}]"],
    sprites: ["id, path (loadFromMod) or source (load), options, fromMod"],
} as const;
