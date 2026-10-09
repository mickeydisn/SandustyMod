/**
 * Public config types for the sandkit wrapper.
 *
 * These are the *authoring* surface: what a mod passes to
 * `elements.register`, `structures.register`, and `items.register`. They build
 * on the host types vendored in `host-types/` so ids stay tagged and optional
 * fields match the host, instead of collapsing into `Record<string, unknown>`.
 */
import type {
    ElementCollectable,
    ElementColorVariant,
    ElementFlammable,
    Interaction,
    MatterType,
    StructureBuildMode,
    StructureRegisterOptions,
    StructureRender,
    StructureRenderUi,
    StructureVariant,
} from "./host-types/domain.d.ts";

export type {
    ElementCollectable,
    ElementColorVariant,
    ElementFlammable,
    Interaction,
    MatterType,
    StructureBuildMode,
    StructureRegisterOptions,
    StructureRender,
    StructureRenderUi,
    StructureVariant,
};

export type { SignalHandler } from "./host-types/signals.ts";
export type { ItemInstance, ItemSpriteMount, ItemSpriteMounts } from "./api/items.ts";
export type { ElementInfoAtCell, ElementPhysicsState } from "./host-types/domain.d.ts";

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
    /** Palette entries, RGB or RGBA. */
    variants?: ElementColorVariant[];
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

    /** Matter category by name or numeric value; normalised before sending. */
    matterType?: MatterTypeName | MatterType;

    density?: number;

    metaColor?: number;

    materialId?: number;

    colors?: ElementColors | ElementColorVariant[];

    duration?: number;
    durationRandom?: ElementDurationRandom;

    flammable?: boolean | ElementFlammable;
    isGrabbable?: boolean;
    isTransportable?: boolean;

    hidden?: boolean;

    /** Tooltip interactions. Typed, no longer `unknown[]`. */
    interactions?: Interaction[];

    /** Named data fields with their default values. */
    defaultDataFields?: Record<string, number>;

    /**
     * Collector value for this element.
     *
     * Verified in the bundle at `bundel.js` 110675 (`liquidGold` registers
     * `collectable: { value: 2 }`), read back at 16697 and 48662.
     */
    collectable?: ElementCollectable;

    /**
     * Whether the element appears in the picker. The engine derives this from
     * `matterType` and `isTransportable` rather than reading it from the
     * definition (see `bundel.js` 30864-30885), so it is reported on reads
     * rather than sent on register.
     */
    visibleInPicker?: boolean;

    getExtraProps?: () => Record<string, unknown>;

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

    /**
     * Structure id whose unlock also unlocks this one.
     *
     * This is the engine's field name (`bundel.js` 125951 — `quantumPortalExit`
     * sets `unlockedBy: "quantumPortal"`). The mod's own config uses the alias
     * `unlockNode`, which `register/core/structures.ts` strips before sending.
     */
    unlockedBy?: string;

    /** Mod-only alias for {@link unlockedBy}. Never sent to the host. */
    unlockNode?: string;

    disallowPick?: boolean;

    /**
     * Engine field behind {@link disallowPick}. Confirmed in the bundle; the
     * mod maps one onto the other in `withSelectionGuard`.
     */
    disallowSelection?: boolean;

    /**
     * Mod-only placement cap.
     *
     * The engine has **no** `maxPlaced` option — caps come from a
     * `placementConfigs` entry carrying an `integer` field (see
     * `PlacementConfigDefinition`). The mod counts these itself in
     * `register/core/placement-limits.ts` and strips this key.
     */
    maxPlaced?: number;

    blockGridType?: string;

    shape?: number[][];

    buildModes?: StructureBuildMode[];
    variants?: StructureVariant[];
    render?: StructureRender;

    draw?: (...args: never[]) => boolean | void;

    /**
     * Mod-only key naming the draw routine to attach.
     *
     * The engine has no `drawKey`; the mod swaps it for a real `draw`
     * function and strips the key.
     */
    drawKey?: string;

    defaultData?: Record<string, unknown>;

    copyData?: boolean;

    rejectWhenBlocked?: boolean;
    altOriginOffsetY?: number;

    tooltipHover?: Record<string, unknown>;

    /**
     * Wrapper-only options.
     *
     * `useRawShape` is not part of the definition the host stores — the mod
     * passes it as a separate argument to `structures.register` after
     * removing it from the body.
     */
    registerOptions?: StructureRegisterOptions;
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
