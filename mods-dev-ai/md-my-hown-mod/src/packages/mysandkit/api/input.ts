import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const input = {
    getMouseCellPosition(): { x: number; y: number } | null {
        try {
            return (g()?.api?.input?.getMouseCellPosition?.() as
                | { x: number; y: number }
                | null
                | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} input.getMouseCellPosition failed`, e);
            return null;
        }
    },
    registerBinding(
        bindingId: string,
        defaultKeys: readonly string[],
        definition: Record<string, unknown>,
    ): void {
        try {
            g()?.api?.input?.registerBinding?.(bindingId, defaultKeys, definition);
        } catch (e) {
            console.warn(`${LOG} input.registerBinding failed`, bindingId, e);
        }
    },

    /** Host alias of {@link getMouseCellPosition}. */
    getMousePositionAtCell(): { x: number; y: number } | null {
        return input.getMouseCellPosition();
    },

    /**
     * Mouse position in world units.
     *
     * Distinct from {@link getMouseCellPosition}, which reports the cell the
     * cursor sits over (`bundel.js` 52042-52049).
     */
    getMousePositionAtWorld(): { x: number; y: number } | null {
        try {
            return (g()?.api?.input?.getMousePositionAtWorld?.() as
                | { x: number; y: number }
                | null
                | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} input.getMousePositionAtWorld failed`, e);
            return null;
        }
    },

    /**
     * Keys currently bound to a binding.
     *
     * Resolves the player's rebinding first and falls back to the registered
     * defaults, returning `[]` for an unknown id (`bundel.js` 52050-52057`).
     */
    getBoundKeys(bindingId: string): string[] {
        try {
            return (g()?.api?.input?.getBoundKeys?.(bindingId) ?? []) as string[];
        } catch (e) {
            console.warn(`${LOG} input.getBoundKeys failed`, bindingId, e);
            return [];
        }
    },

    /**
     * Human-readable key label for a binding.
     *
     * Pass a fallback label for bindings with no registered name.
     */
    getDisplayKey(bindingId: string, defaultLabel?: string): string {
        try {
            return (g()?.api?.input?.getDisplayKey?.(bindingId, defaultLabel) ??
                defaultLabel ??
                bindingId) as string;
        } catch (e) {
            console.warn(`${LOG} input.getDisplayKey failed`, bindingId, e);
            return defaultLabel ?? bindingId;
        }
    },

    /** Fire a binding as though the key had been pressed and released. */
    triggerBinding(bindingId: string): boolean {
        try {
            const ns = g()?.api?.input;
            const fn = ns?.triggerBinding;
            if (typeof fn !== "function") return false;
            fn.call(ns, bindingId);
            return true;
        } catch (e) {
            console.warn(`${LOG} input.triggerBinding failed`, bindingId, e);
            return false;
        }
    },

    /** Hold a binding down without releasing it. */
    pressBinding(bindingId: string): boolean {
        try {
            const ns = g()?.api?.input;
            const fn = ns?.pressBinding;
            if (typeof fn !== "function") return false;
            fn.call(ns, bindingId);
            return true;
        } catch (e) {
            console.warn(`${LOG} input.pressBinding failed`, bindingId, e);
            return false;
        }
    },

    /** Release a binding previously held by {@link pressBinding}. */
    releaseBinding(bindingId: string): boolean {
        try {
            const ns = g()?.api?.input;
            const fn = ns?.releaseBinding;
            if (typeof fn !== "function") return false;
            fn.call(ns, bindingId);
            return true;
        } catch (e) {
            console.warn(`${LOG} input.releaseBinding failed`, bindingId, e);
            return false;
        }
    },

    /** Clear accumulated mouse state (clicks, drags, wheel). */
    resetMouseState(): boolean {
        try {
            const ns = g()?.api?.input;
            const fn = ns?.resetMouseState;
            if (typeof fn !== "function") return false;
            fn.call(ns);
            return true;
        } catch (e) {
            console.warn(`${LOG} input.resetMouseState failed`, e);
            return false;
        }
    },

    /** Whether the control modifier is held. */
    isCtrlHeld(): boolean {
        try {
            return g()?.api?.input?.isCtrlHeld?.() === true;
        } catch (e) {
            console.warn(`${LOG} input.isCtrlHeld failed`, e);
            return false;
        }
    },

    /** Whether the alt modifier is held. */
    isAltHeld(): boolean {
        try {
            return g()?.api?.input?.isAltHeld?.() === true;
        } catch (e) {
            console.warn(`${LOG} input.isAltHeld failed`, e);
            return false;
        }
    },
};
