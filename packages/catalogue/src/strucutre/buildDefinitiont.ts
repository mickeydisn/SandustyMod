/** Shared options for registering any structure-based control. */
export interface StructureOptions {
    id: string;
    name: string;
    spriteId: string;
    renderSize: { width: number; height: number };
    def: {
        nameKey?: string;
        description?: string;
        categoryKey?: string;
        order?: number;
        render?: { imageName: string; size: { width: number; height: number } };
        shape?: number[][];
        variants?: Array<{ id: string; angles: number[] }>;
        buildModes?: Array<{ type: string; directions?: string[] }>;
    };
    defaultData?: Record<string, unknown>;
    activeOnPlace?: boolean;
    cells?: number | { w: number; h: number };
}

/** Build a sandkit structure definition from shared options (`cells` → shape/renderSize). */
export function buildStructureDefinition(
    opts: StructureOptions,
): Record<string, unknown> {
    const makeEmptyShape = (x: number, y: number) =>
        Array.from({ length: x }, () => Array(y).fill(0));

    const _shapeEmpty = makeEmptyShape(
        Math.round(opts.renderSize.width / 4),
        Math.round(opts.renderSize.height / 4),
    );

    const def = opts.def;
    return {
        id: opts.id,
        name: opts.name,
        categoryKey: def.categoryKey ?? "misc",
        buildModes: def.buildModes ?? [{ type: "single" }],
        variants: def.variants ?? [{ id: opts.id, angles: [0] }],
        shape: def.shape ?? _shapeEmpty,
        render: def.render ?? {
            imageName: opts.spriteId,
            size: opts.renderSize ?? { width: 16, height: 16 },
        },
        copyData: true,
        defaultData: {
            ...(opts.defaultData ?? {}),
        },
        // Menu definition
        ...(def.nameKey ? { nameKey: def.nameKey } : {}),
        ...(def.description ? { description: def.description } : {}),
        ...(def.order != null ? { order: def.order } : {}),
    };
}
