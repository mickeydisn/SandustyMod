import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

/**
 * Options for releasing camera focus.
 *
 * The facade throws a `RangeError` unless `durationMs` is finite and within
 * **0–60000** inclusive (`extra-mod-runtime.js` 1165-1168).
 */
export type CameraReleaseOptions = {
    /** Milliseconds spent easing focus back to the player. 0–60000. */
    durationMs?: number;
};

export const camera = {
    /** Snap the camera back onto the player, clearing any manual focus. */
    snapToPlayer(): boolean {
        try {
            const ns = g()?.api?.camera;
            if (typeof ns?.snapToPlayer !== "function") return false;
            ns.snapToPlayer();
            return true;
        } catch (e) {
            console.warn(`${LOG} camera.snapToPlayer failed`, e);
            return false;
        }
    },

    /**
     * Focus the camera on a world position.
     *
     * Both coordinates must be finite — the facade throws a `TypeError`
     * otherwise (`extra-mod-runtime.js` 1152-1154).
     *
     * Returns `false` when focus is unavailable (cinematic freecam, recon
     * mode, or a playing waypoint), in which case nothing is moved.
     */
    setFocusAtWorld(worldX: number, worldY: number): boolean {
        try {
            const ns = g()?.api?.camera;
            const fn = ns?.setFocusAtWorld;
            if (typeof fn !== "function") return false;
            return fn.call(ns, worldX, worldY) === true;
        } catch (e) {
            console.warn(`${LOG} camera.setFocusAtWorld failed`, worldX, worldY, e);
            return false;
        }
    },

    /**
     * Release manual focus and return to following the player.
     *
     * `durationMs` must be within 0–60000 or the facade throws a `RangeError`.
     * Returns `false` when this mod does not currently hold focus, which is
     * the normal outcome if focus was never set.
     */
    releaseFocus(options?: CameraReleaseOptions): boolean {
        try {
            const ns = g()?.api?.camera;
            const fn = ns?.releaseFocus;
            if (typeof fn !== "function") return false;
            return fn.call(ns, options) === true;
        } catch (e) {
            console.warn(`${LOG} camera.releaseFocus failed`, options, e);
            return false;
        }
    },
};