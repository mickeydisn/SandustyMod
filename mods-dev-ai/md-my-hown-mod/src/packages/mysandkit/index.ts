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
    ItemConfig,
    ItemSprite,
    MatterTypeName,
    SignalHandler,
    StructureBuildMode,
    StructureConfig,
    StructureRender,
    StructureRenderUi,
    StructureVariant,
} from "./types.ts";
