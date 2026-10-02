export const DRAG_SLOP = 4;

export function exceedsSlop(
    startX: number,
    startY: number,
    x: number,
    y: number,
    slop: number = DRAG_SLOP,
): boolean {
    return Math.abs(x - startX) > slop || Math.abs(y - startY) > slop;
}

export function clampChip(
    x: number,
    y: number,
    vw: number,
    vh: number,
    w: number,
    h: number,
): { x: number; y: number } {
    const maxX = Math.max(0, vw - w);
    const maxY = Math.max(0, vh - h);
    return {
        x: Math.max(0, Math.min(maxX, x)),
        y: Math.max(0, Math.min(maxY, y)),
    };
}
