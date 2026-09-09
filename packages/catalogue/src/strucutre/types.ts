export type AlignMode = "floor" | "wall" | "center";

export interface CatalogueItem {
    // Basic info
    id: string;
    label: string;
    description: string;
    width: number;
    height: number;
    // Sprite
    filePath: string;
    spriteId?: string;
    // Cat
    category: string;
    tags?: string[];
    sizes?: string[];
    // Sprite alignment and mirroring
    align?: AlignMode;
    isMirrored?: boolean;
    // Data for structure copyData and defaultData, if any. This is optional, but if provided, it will be used to set the structure's data when placed in the world.
    data?: Record<string, unknown>;
}
