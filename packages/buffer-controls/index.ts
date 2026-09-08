/**
 * @sandmd/buffer-controls — wire a JsonBuffer record to placeable structures.
 *
 * Public surface:
 *   registerBufferControls(config)  the single entry point
 *   BufferControls{Config,Handles,…}  config/handles types
 */
export { registerBufferControls } from "./src/buffer-controls.ts";
export type {
    BufferControlsActionSprites,
    BufferControlsCategoryLabels,
    BufferControlsConfig,
    BufferControlsHandles,
    BufferControlsKindSprites,
    BufferControlsMenu,
    BufferControlsSpriteFile,
    BufferControlsSprites,
} from "./src/types.ts";
