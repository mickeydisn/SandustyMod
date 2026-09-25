/**
 * Structure skeleton for process buildings (picker-only).
 *
 * Shape: 4×4 full of 0 (same as test-blocks FOOTPRINT).
 * Eat/emit still scan interior cells (sx+0..3, sy+0..3).
 */
import { PROCESS_SIZE } from "../types.ts";

/** 4×4 footprint filled with 0. */
export function makeProcessShape(): number[][] {
    return Array.from({ length: PROCESS_SIZE }, () =>
        Array.from({ length: PROCESS_SIZE }, () => 0)
    );
}

export function sectionBuildSingle(typeId: string) {
    return {
        buildModes: [
            { type: "single" as const },
            {
                type: "line" as const,
                directions: ["horizontal", "vertical"] as const,
            },
        ],
        variants: [{ id: typeId, angles: [0, 90, 180, 270] }],
    };
}

export function buildProcessData(processId: string) {
    return {
        copyData: true,
        useRawShape: true,
        defaultData: { processId },
    };
}

export function buildProcessRender(
    spriteId: string | undefined,
    size: { width: number; height: number },
): Record<string, unknown> {
    if (!spriteId) {
        return {
            render: {
                size,
                offset: { x: 0, y: 0 },
                ui: { outline: true },
            },
        };
    }
    return {
        render: {
            imageName: spriteId,
            size,
            offset: { x: 0, y: 0 },
            ui: { outline: true, imageName: spriteId },
        },
    };
}

export function buildProcessTooltips() {
    return {
        tooltipHover: {
            type: "custom",
            dataFieldMessage: {
                messageKey: "{processId}",
                fields: [{ param: "processId", field: "processId" }],
            },
        },
    };
}
