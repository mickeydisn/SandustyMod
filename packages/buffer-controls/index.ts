/**
 * @sandmd/buffer-controls — wire a JsonBuffer record to placeable structures.
 *
 * Public surface:
 *   registerBufferControls(config)  the single entry point
 *   BufferControls{Config,Handles,…}  config/handles types
 */
export { registerBufferControls } from "./src/buffer-controls.ts";
export type {
    ActionOp,
    BufferControlsCategoryLabels,
    BufferControlsConfig,
    BufferControlsHandles,
    BufferControlsMenu,
    BufferControlsPickerConfig,
    BufferControlsSprite,
    BufferControlsSprites,
    BufferControlsStorageConfig,
} from "./src/types.ts";
