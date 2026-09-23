/**
 * @sandmd/buffer-controls — wire a JsonBuffer record to placeable structures.
 *
 * Public surface:
 *   registerBufferControls(config)  the single entry point
 *   BufferControls{Config,Handles,…}  config/handles types
 */
export { registerBufferControls } from "./src/buffer-controls.ts";
export type {
    BufferControlsCategoryLabels,
    BufferControlsConfig,
    BufferControlsHandles,
    BufferControlsMenu,
    BufferControlsSprite,
    BufferControlsSprites,
} from "./src/types.ts";
