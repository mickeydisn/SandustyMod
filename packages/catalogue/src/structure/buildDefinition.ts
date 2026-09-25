/** Shared options for registering a structure-based control. */
export interface StructureOptions {
    id: string;
    name: string;
    def: {
        nameKey?: string;
        description?: string;
        categoryKey: string;
        order?: number;
        hideFromBuildMenu: boolean;
        render: { imageName: string; size: { width: number; height: number } };
        shape: number[][];
        variants: Array<{ id: string; angles: number[] }>;
        buildModes: Array<{ type: string; directions?: string[] }>;
    };
    defaultData: Record<string, unknown>;
}

/** Build a rectangular empty shape for a structure definition. */
export function makeShape(width: number, height: number): number[][] {
    return Array.from({ length: width }, () => Array(height).fill(0));
}

/** Build a sandkit structure definition from fully specified options. */
export function buildStructureDefinition(
    opts: StructureOptions,
): Record<string, unknown> {
    const def = opts.def;
    return {
        id: opts.id,
        name: opts.name,
        categoryKey: def.categoryKey,
        buildModes: def.buildModes,
        variants: def.variants,
        shape: def.shape,
        hideFromBuildMenu: def.hideFromBuildMenu,
        render: def.render,
        copyData: true,
        defaultData: opts.defaultData,
        ...(def.nameKey === undefined ? {} : { nameKey: def.nameKey }),
        ...(def.description === undefined ? {} : { description: def.description }),
        ...(def.order === undefined ? {} : { order: def.order }),
    };
}
