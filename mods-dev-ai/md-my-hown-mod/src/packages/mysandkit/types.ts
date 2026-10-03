export type SignalHandler = (...args: unknown[]) => unknown;

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
