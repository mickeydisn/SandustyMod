export { g } from "./host.ts";
export { api } from "./api/index.ts";

export { resolveElementRef, resolveTerrainRef } from "./internal/refs.ts";
export { normalizeElementPatch } from "./internal/normalize.ts";
export { type CompiledItemAction, setItemActionCompiler } from "./internal/normalize.ts";

export type {
    ElementColors,
    ElementColorVariantFromData,
    ElementConfig,
    ElementDurationRandom,
    ElementInfoAtCell,
    ElementPhysicsState,
    ItemConfig,
    ItemInstance,
    ItemSprite,
    ItemSpriteMount,
    ItemSpriteMounts,
    MatterTypeName,
    SignalHandler,
    StructureBuildMode,
    StructureConfig,
    StructureRender,
    StructureRenderUi,
    StructureVariant,
} from "./types.ts";

/**
 * Host id / handle types.
 *
 * These are what replaced the old `string | number` unions: an `ElementRef` is
 * a tagged pair of `ElementId | ElementType`, so passing a structure ref where
 * an element ref belongs is now a compile error instead of a silent no-op.
 */
export type {
    ElementColorVariant,
    ElementFlammable,
    ElementId,
    ElementRef,
    ElementType,
    ElementWriteOptions,
    Interaction,
    InteractionCustom,
    InteractionDestroyer,
    InteractionEntity,
    InteractionFlammable,
    InteractionFreezable,
    InteractionMeltable,
    InteractionStructure,
    InteractionStructureMetadata,
    ItemId,
    ItemType,
    MatterType,
    PlacementChoiceField,
    PlacementChoiceOption,
    PlacementConfigDefinition,
    PlacementField,
    PlacementIntegerField,
    PlacementLabel,
    PlacementUpgradeMax,
    StructureId,
    StructureProcessingDefinition,
    StructureRecipeDefinition,
    StructureRef,
    StructureRegisterOptions,
    StructureType,
    TerrainColorGradient,
    TerrainColorPattern,
    TerrainDataAtCell,
    TerrainDefinition,
    TerrainId,
    TerrainMutationOptions,
    TerrainRef,
    TerrainType,
    TerrainWriteOptions,
} from "./host-types/domain.d.ts";

export type {
    CellCoordinates,
    CellId,
    CellXY,
    JsonObject,
    JsonValue,
    Size2,
    TaggedNumber,
    TaggedString,
    Vector2,
} from "./host-types/shared.d.ts";

export type { SignalKind } from "./api/signals.ts";
export type { ElementRegistration } from "./api/elements.ts";
export type { StructureInstance } from "./api/structures.ts";
export type {
    SignalInteractableHandler,
    SignalSenderReader,
    SignalTarget,
} from "./host-types/signals.ts";
