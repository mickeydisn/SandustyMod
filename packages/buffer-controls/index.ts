/**
 * @sandmd/buffer-controls — wire a JsonBuffer record to placeable structures.
 *
 * Public surface:
 *   registerBufferControls(config)  the single entry point
 *   BufferControls{Config,Handles,…}  config/handles types
 *   buildFieldsRecord / fieldsToSprites  the field-list derivations
 */
export { registerBufferControls } from "./src/buffer-controls.ts";
export {
    buildFieldsRecord,
    fieldCategory,
    fieldTag,
    fieldsToSprites,
    lastSegment,
    normalizeFieldsRecord,
    parentPath,
} from "./src/fields.ts";
export type {
    ActionOp,
    BufferControlsCategoryLabels,
    BufferControlsConfig,
    BufferControlsField,
    BufferControlsFieldSprite,
    BufferControlsHandles,
    BufferControlsMenu,
    BufferControlsPickerConfig,
    BufferControlsSprite,
    BufferControlsSprites,
    BufferControlsStorageConfig,
    SpriteAction,
} from "./src/types.ts";
