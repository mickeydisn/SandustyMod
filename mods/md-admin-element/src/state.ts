/**
 * mdadmin — panel state.
 *
 * `state.open` is toggled by the keyboard shortcut (see `main.ts`); `repaint` is
 * the bump function the mounted panel registers so the shortcut can force a
 * re-render from outside React.
 */
import type { Setter } from "./types.ts";

/** Panel visibility. */
export const state = { open: true };

let repaint: Setter<number> | null = null;

/** Called by the panel's effect on mount / unmount. */
export function setRepaint(fn: Setter<number> | null): void {
    repaint = fn;
}

/** Force a panel re-render when a panel is mounted. */
export function repaintPanel(): void {
    if (repaint) repaint((v) => v + 1);
}
