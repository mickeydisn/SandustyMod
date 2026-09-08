/**
 * Minimal build-modes / variants block for buffer-controls structures.
 *
 * Every structure here is placed "single" (one cell, no rotation), so the three
 * registers share one definition instead of repeating the block per structure.
 */
export const sectionBuild = {
    single: (typeId: string) => ({
        buildModes: [{ type: "single" }],
        variants: [{ id: typeId, angles: [0] }],
    }),
};
