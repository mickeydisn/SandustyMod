/**
 * Domain id / handle types for the host API, vendored from
 * `@sandustry-modding/types` (`__scraped-mods/SandustryTypes/src/sandkit/api/`).
 *
 * Each id has a numeric *type handle* and a string *id*, kept as a tagged union
 * so a `TerrainRef` is never accidentally passed where an `ElementRef` belongs.
 */
import type {
    CellTypeEnum,
    ElementTypeEnum,
    ItemIdEnum,
    ItemTypeEnum,
    MatterTypeEnum,
} from "./enums.d.ts";
import type { CellId, TaggedNumber, TaggedString } from "./shared.d.ts";

/* ------------------------------------------------------------------ elements */

/** Numeric element type handle. Built-ins autocomplete; runtime values are tagged. */
export type ElementType = ElementTypeEnum | TaggedNumber<"elementType">;

/** Mod or built-in element string id. */
export type ElementId = TaggedString<"elementId">;

/** Type handle or string id accepted by element lookup and mutation helpers. */
export type ElementRef = ElementType | ElementId;

/** Palette entry: RGB, or RGBA when alpha is set. */
export type ElementColorVariant =
    | readonly [r: number, g: number, b: number]
    | readonly [r: number, g: number, b: number, a: number];

/** Tooltip metadata shared by structure and custom interaction kinds. */
export type InteractionStructureMetadata = {
    /** i18n key for custom interaction label text. */
    textKey?: string;
    /** Hide the label when a data field matches a value. */
    crossedOutWhen?: { dataField: number; equals: number };
    /** Show the label only when a data field matches a value. */
    visibleWhen?: { dataField: number; equals: number };
    /** Require the text key to exist in the active locale. */
    onlyWhenTranslated?: boolean;
};

/** Interaction that destroys specific items. */
export type InteractionDestroyer = {
    kind: "destroyer";
    /** Item ids removed by this interaction (for example `"drill"`). */
    items: readonly string[];
};

/** Interaction that affects specific structures. */
export type InteractionStructure = InteractionStructureMetadata & {
    kind: "structure";
    /** Structure ids shown in the interaction tooltip. */
    structures: readonly string[];
};

/** Interaction that affects specific entities. */
export type InteractionEntity = {
    kind: "entity";
    /** Entity type ids referenced by the interaction. */
    entities: readonly string[];
};

/** Interaction that marks the element as flammable. */
export type InteractionFlammable = { kind: "flammable" };

/** Interaction that marks the element as meltable. */
export type InteractionMeltable = { kind: "meltable" };

/** Interaction that marks the element as freezable. */
export type InteractionFreezable = { kind: "freezable" };

/** Interaction handled by custom mod logic and tooltip text. */
export type InteractionCustom = InteractionStructureMetadata & { kind: "custom" };

/** Union of element interaction kinds for tool and structure logic. */
export type Interaction =
    | InteractionDestroyer
    | InteractionStructure
    | InteractionEntity
    | InteractionFlammable
    | InteractionMeltable
    | InteractionFreezable
    | InteractionCustom;

/* ------------------------------------------------------------------ terrains */
/** Numeric terrain cell type handle. */
export type TerrainType = CellTypeEnum | TaggedNumber<"terrainType">;

/** Mod or built-in terrain string id. */
export type TerrainId = TaggedString<"terrainId">;

/** Type handle or string id accepted by terrain mutation helpers. */
export type TerrainRef = TerrainType | TerrainId;

/** Terrain cell data returned by `terrains.getDataAtCell`. */
export type TerrainDataAtCell = {
    /** Numeric terrain cell type. */
    cellType: TerrainType;
    /** Current hit points, or null when the terrain has no hp. */
    hitPoints: number | null;
    /**
     * Mirror of `hitPoints`, always emitted by the facade.
     *
     * Both fields are set from the same `hp` in
     * `extra-mod-runtime.js` 2262-2269.
     */
    hp?: number | null;
};

/** Options for terrain create, replace, or remove calls. */
export type TerrainMutationOptions = {
    /** Skip shadow updates around the changed cell. */
    skipShadow?: boolean;
};

/* ---------------------------------------------------------------- structures */

/** Numeric structure type handle. */
export type StructureType = TaggedNumber<"structureType">;

/** Mod or built-in structure string id. */
export type StructureId = TaggedString<"structureId">;

/** Type handle or string id accepted by structure helpers. */
export type StructureRef = StructureType | StructureId;

/** Placement shape for one build mode. */
export type StructureBuildMode = {
    /** `single`, `line`, `rectangle`, … */
    type: string;
    /** Allowed angles for this mode. */
    directions?: string[];
    [key: string]: unknown;
};

/** A structure render variant: id plus allowed angles in radians. */
export type StructureVariant = {
    /** Unique variant id. */
    id: string;
    /** Allowed angles. */
    angles: number[];
};

/** UI size / offset box for a structure sprite. */
export type StructureRenderUi = {
    size?: { width: number; height: number };
    width?: string;
    height?: string;
    offset?: { x: number; y: number };
    objectPosition?: string;
    clipToBounds?: boolean;
    imageName?: string;
};

/** Sprite instructions for a structure. */
export type StructureRender = {
    imageName?: string;
    size?: { width: number; height: number };
    offset?: { x: number; y: number };
    ui?: StructureRenderUi;
    spritesheet?: {
        frameBuffer?: { key: string; index?: number };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

/** Options forwarded to `structures.register`. */
export type StructureRegisterOptions = {
    /** Register the raw shape instead of the derived mask. */
    useRawShape?: boolean;
};

/* --------------------------------------------------------------------- items */

/** Inventory item id. Built-ins autocomplete; custom string ids allowed. */
export type ItemId = ItemIdEnum | TaggedString<"itemId">;

/** Item category handle. */
export type ItemType = ItemTypeEnum | TaggedNumber<"itemType">;

/* ------------------------------------------------------------------- matter */

/** Physical behaviour category for an element. */
export type MatterType = MatterTypeEnum | TaggedNumber<"matterType">;

/**
 * Result of `elements.getInfoAtCell`.
 *
 * Returns `null` for a non-element cell, and also for a particle cell whose
 * link index is `<= 0` (`bundel.js` 33514-33535).
 */
export type ElementInfoAtCell = {
    /** Element type at the cell; for a particle, the *linked* type. */
    elementType: ElementType;
    /** True when the cell is a particle carrying another element. */
    isParticle: boolean;
    /** Opaque cell handle. */
    cellId: CellId;
    /** Slot index within the chunk's element data. */
    elementIndex: number;
};

/**
 * Physics state for an element cell.
 *
 * Passed straight to `elements.setPhysics` (`extra-mod-runtime.js` 1469).
 */
export type ElementPhysicsState = {
    [key: string]: unknown;
};

/**
 * Per-write options for element creation and replacement.
 *
 * The facade normalises `durationTicks` into `duration` (`Fe`, line 741) and
 * the engine reads these fields off the options bag
 * (`extra-mod-runtime.js` 824-831).
 */
export type ElementWriteOptions = {
    /** Named data fields written alongside the element. */
    data?: Record<string, number>;
    /** Overrides the element's default density. */
    density?: number;
    /**
     * Lifetime in ticks. Preferred over {@link duration}; the facade copies
     * it to `duration` when present.
     */
    durationTicks?: number;
    /** Lifetime; used only when {@link durationTicks} is absent. */
    duration?: number;
    /** Spawn as free-falling rather than settled. */
    isFreeFalling?: boolean;
    [key: string]: unknown;
};

/** Collector gold for this element. Verified at `bundel.js` 110675. */
export type ElementCollectable = {
    /** Units yielded per collected cell. */
    value?: number;
};

/** Burn product when fire or flame consumes this element. */
export type ElementFlammable = {
    /** Element id written in place of the burned cell. */
    outputElementId?: string;
    /** Chance that the output is written (0–1). */
    outputChance?: number;
    /** When true, spawned fire copies this cell's remaining duration. */
    fireInheritsDuration?: boolean;
    /** Fire lifetime seconds, or `[min, max]`. */
    duration?: number | readonly number[];
};

/**
 * Terrain pattern: a tiled HSL grid.
 *
 * `colorsHSL` rows are **RGBA** (4 components) and are indexed `[y][x]`.
 * Verified against the shipped bundle (`bundel.js` 113456, 113496).
 */
export type TerrainColorPattern = {
    /** Pattern tile size as `[width, height]`. */
    size?: [number, number];
    /** Per-cell RGBA HSL colours, outer array indexed by row. */
    colorsHSL?: (readonly [
        number,
        number,
        number,
        number,
    ])[][];
};

/**
 * Terrain damage gradient.
 *
 * Stops are ordered from highest `hp` to lowest. Each `color` is HSL.
 * Verified against the shipped bundle (`bundel.js` 113508, 113530).
 */
export type TerrainColorGradient = {
    stops?: readonly { hp: number; color: readonly [number, number, number] }[];
};

/**
 * Terrain definition shape.
 *
 * Every field below is confirmed present in the shipped bundle
 * (`terrains.register` call sites, e.g. `bundel.js` 128544, 134102, 134118).
 */
export type TerrainDefinition = {
    /** Unique mod-scoped terrain id. */
    id: string;

    /** i18n key for the terrain display name. */
    nameKey?: string;
    /** i18n key for the terrain description. */
    descriptionKey?: string;
    /** Overrides the display name key entirely. */
    displayNameOverrideKey?: string;

    /** Default terrain hit points. */
    hp?: number;
    /**
     * Material id used for rendering.
     *
     * The host validates this and throws unless it is a number strictly
     * greater than `obstacleBreakpoint` (100) and strictly below 150 — i.e.
     * **101–149** (`bundel.js` 50040-50046).
     */
    materialId?: number;
    /** UI/meta color as 0xRRGGBB. */
    metaColor?: number;
    /** Base terrain colour as `[h, s, l]` — exactly 3 components. */
    colorHSL?: [number, number, number];
    /** Tiled RGBA colour pattern. */
    colorPattern?: TerrainColorPattern;
    /** Damage-keyed colour gradient. */
    colorGradient?: TerrainColorGradient;

    /** Tool item ids required to excavate this terrain. */
    excavationRequirements?: readonly string[];
    /** Tooltip interactions shown for this terrain. */
    interactions?: readonly Interaction[];

    /**
     * Element dropped when the terrain is destroyed.
     *
     * `elementType` is a **resolved numeric handle**, not a string id — the
     * host does not resolve ids here. `null` means "nothing is dropped",
     * which is a real case in the bundle (`bundel.js` 113519, `sand2`).
     */
    output?: {
        elementType: ElementType | null;
        /** 0–1. Defaults to 1 when omitted by the wrapper. */
        chance: number;
    };

    /** Element type rendered behind this terrain. */
    backgroundElementType?: ElementType;
    /** Marks the terrain as fog. */
    fog?: boolean;
    /** Element type used while the terrain is fogged. */
    fogElementType?: ElementType;
    /** Skip shadow updates around the terrain. */
    noShadow?: boolean;
    /** Counts toward the "is a building" check. */
    isBuilding?: boolean;
    /** Terrain burns when touched by fire. */
    flammable?: boolean;
    /** Burn duration range, used with `flammable`. */
    burnDurationRandom?: { min: number; max: number };
    /** Fire duration range, used with `flammable`. */
    fireDurationRandom?: { min: number; max: number };

    [key: string]: unknown;
};

/**
 * Structure recipe definition.
 *
 * Element slots accept either an id or an already-resolved handle: the mod
 * facade resolves ids for you in `s()` (`extra-mod-runtime.js` 1068), which
 * maps a string through `elements.getElementTypeFromId` and passes numbers
 * through untouched. Only the raw `FH` layer requires pre-resolved numbers.
 *
 * `outputs` is the weighted form actually used by the engine; `output` plus
 * `chance` is the single-result shorthand. A missing or non-array `outputs`
 * throws a `TypeError` (line 1070).
 */
export type StructureRecipeDefinition = {
    /** Element consumed by the recipe. */
    input?: ElementRef;
    /** Primary element produced. */
    output?: ElementRef;
    /** Per-output chance in 0–1. */
    chance?: number;
    /** Weighted outputs. Must be an array when present. */
    outputs?: readonly { elementType: ElementRef; chance?: number }[];
    /** Extra outputs above the structure. */
    outputsAbove?: readonly { elementType: ElementRef; chance?: number }[];
    /** Extra outputs below the structure. */
    outputsBelow?: readonly { elementType: ElementRef; chance?: number }[];
    /**
     * Minimum downward velocity for kinetic presses.
     *
     * Prefers {@link minimumDownwardVelocityCellsPerSecond} when both are
     * given (`extra-mod-runtime.js` 1092).
     */
    minimumDownwardVelocity?: number;
    /** Explicitly named alias for {@link minimumDownwardVelocity}. */
    minimumDownwardVelocityCellsPerSecond?: number;
    [key: string]: unknown;
};

/**
 * Processing definition attached to a structure type.
 *
 * The host validates this in `be()` (`extra-mod-runtime.js` 775-782) and
 * throws before the definition is ever stored:
 *
 * - the definition itself must be an object,
 * - `intervalMs` is required, must be finite, and must be **greater than
 *   zero** (`RangeError` otherwise),
 * - `process` is required and must be a **synchronous** function — an
 *   `AsyncFunction` is rejected with a `TypeError`.
 */
export type StructureProcessingDefinition = {
    /** Structure the processor belongs to. */
    structureId?: StructureId;
    /**
     * Run interval in milliseconds. Required, and must be `> 0`.
     *
     * @throws RangeError at registration when zero or negative.
     */
    intervalMs: number;
    /**
     * Per-tick callback. Must be synchronous; returning a Promise is
     * rejected at registration.
     */
    process: (...args: never[]) => unknown;
    /** `type` shares one instance, `instance` runs per placed structure. */
    mode?: "type" | "instance";
    [key: string]: unknown;
};

/* ------------------------------------------------------ placement configs */

/**
 * Per-write options for terrain create / replace / remove.
 *
 * The terrain facade does not normalise these (unlike elements, which copy
 * `durationTicks` to `duration` at line 741), so `hp` and `data` are passed
 * through as given.
 */
export type TerrainWriteOptions = {
    /** Starting hit points for the new terrain. */
    hp?: number;
    /** Named data fields stored alongside the terrain. */
    data?: Record<string, number>;
    [key: string]: unknown;
};

/**
 * Placement-cap override for one structure.
 *
 * The engine validates this in `registerPlacementConfig`
 * (`bundel.js` 81463-81476): `structureId` and a non-empty `fields` array are
 * required, every field needs a unique non-empty `id` plus a `label` or
 * `labelKey`, and a `choice` field needs at least one labelled option.
 * Anything else throws.
 */
export type PlacementConfigDefinition = {
    /** Structure these fields belong to. Required. */
    structureId: StructureId;
    /** Hotbar fields. Must be non-empty. */
    fields: readonly PlacementField[];
    [key: string]: unknown;
};

/** Shared shape for field labels. */
export type PlacementLabel = {
    /** Plain label text. */
    label?: string;
    /** i18n key used instead of `label`. */
    labelKey?: string;
};

/** Integer field; `max` caps how many may be placed. */
export type PlacementIntegerField = PlacementLabel & {
    type: "integer";
    /** Unique within the config. Required. */
    id: string;
    /** Lower bound. Defaults to `Number.MIN_SAFE_INTEGER`. */
    min?: number;
    /** Upper bound. A number, or an upgrade-derived bound. */
    max?: number | PlacementUpgradeMax;
    /** Starting value. */
    default?: number;
};

/**
 * Upgrade-derived upper bound.
 *
 * The engine computes `max( minimum, level + offset )` where `level` comes
 * from `store.upgrades[itemId][upgradeId]` (`bundel.js` 81431-81440).
 */
export type PlacementUpgradeMax = {
    /** Item owning the upgrade. */
    itemId: ItemId;
    /** Upgrade key read off that item. */
    upgradeId: string;
    /** Hard floor regardless of level. */
    minimum?: number;
    /** Added to the current level. */
    offset?: number;
};

/** One labelled option of a `choice` field. */
export type PlacementChoiceOption = PlacementLabel & {
    value: string | number;
};

/** Enum-style field constrained to `options`. */
export type PlacementChoiceField = PlacementLabel & {
    type: "choice";
    /** Unique within the config. Required. */
    id: string;
    /** Must be non-empty. */
    options: readonly PlacementChoiceOption[];
    default?: string | number;
};

/** Any field accepted inside `fields`. */
export type PlacementField = PlacementIntegerField | PlacementChoiceField;
