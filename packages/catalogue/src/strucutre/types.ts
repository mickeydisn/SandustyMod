export type AlignMode = "floor" | "wall" | "center";

export interface CatalogueItem {
    // Basic info
    id: string;
    label: string;
    description: string;
    category: string;
    // Sprite
    width: number;
    height: number;
    filePath: string;
    spriteId?: string;
    // Sprite alignment and mirroring
    align?: AlignMode;
    isMirrored?: boolean;
    // Data for structure copyData and defaultData, if any. This is optional, but if provided, it will be used to set the structure's data when placed in the world.
    data?: Record<string, unknown>;
    // catalogue :
    /** Directory tags (subfolder names). */
    tags?: string[];
    /** Size tags (e.g. "1x1", "3x2"), parsed from the filename. */
    sizes?: string[];
}
