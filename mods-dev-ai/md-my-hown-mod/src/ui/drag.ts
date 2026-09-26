/**
 * The two decisions a drag has to make, kept pure so they can be tested.
 *
 * Both exist because of a specific annoyance rather than for tidiness. A chip
 * that both drags and opens has to tell the two apart, or every attempt to move
 * it opens the panel; and a chip that can be dragged has to be stopped at the
 * screen edge, or it can be thrown away and never found again.
 */

/**
 * How far a pointer must travel before a press counts as a drag rather than a
 * click. Below this the chip is jittery; above it, a genuine click to open it
 * needs an unreasonably steady hand.
 */
export const DRAG_SLOP = 4;

/** Has the pointer travelled far enough for this to be a drag, not a click? */
export function exceedsSlop(
    startX: number,
    startY: number,
    x: number,
    y: number,
    slop: number = DRAG_SLOP,
): boolean {
    return Math.abs(x - startX) > slop || Math.abs(y - startY) > slop;
}

/**
 * Clamp a dragged chip so it stays fully on screen.
 *
 * Clamped by the chip's own size rather than a fixed inset, so a wide chip is
 * not allowed to hang off the right edge and a tall one off the bottom.
 * Viewport values are clamped to a sane minimum so a zero-sized host window
 * cannot produce a negative range and flip the chip to the far side.
 */
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
