import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

/** A light handle returned by the temporary/vfx light helpers. */
export type LightHandle = {
    /** Light id, accepted by `removeById`. */
    lightId: number;
    /** Internal index — same value as {@link LightHandle.lightId}. */
    index: number;
};

/**
 * Options for creating a light.
 *
 * `durationTicks` is normalised to `duration` by the facade before it reaches
 * the engine (`extra-mod-runtime.js` 1264-1266).
 */
export type LightOptions = {
    /** Radius of the emitted light. */
    radius?: number;
    /** Packed colour as 0xRRGGBB. */
    color?: number;
    /** Brightness multiplier. */
    intensity?: number;
    /**
     * Lifetime in ticks. Preferred over {@link duration}; the facade copies
     * it across when present.
     */
    durationTicks?: number;
    /** Lifetime, used only when {@link durationTicks} is absent. */
    duration?: number;
    [key: string]: unknown;
};

/**
 * Shared surface of the temporary (`lights.temporary`) and `lights.vfx`
 * namespaces — both are the *same* object in the facade.
 *
 * Note these route through `effects.createLight` / `effects.removeLight`, not
 * `lights.*` (`extra-mod-runtime.js` 1745-1748), which is why they take and
 * return a light id.
 */
function temporaryLights() {
    return {
        /**
         * Create a light at world coordinates.
         *
         * Returns `{ lightId, index }` — both hold the same value.
         */
        createAtWorld(
            worldX: number,
            worldY: number,
            options?: LightOptions,
        ): LightHandle | null {
            try {
                const ns = g()?.api?.lights?.temporary;
                const fn = ns?.createAtWorld;
                if (typeof fn !== "function") return null;
                return (fn.call(ns, worldX, worldY, options) ??
                    null) as LightHandle | null;
            } catch (e) {
                console.warn(`${LOG} lights.temporary.createAtWorld failed`, e);
                return null;
            }
        },

        /** Remove a light previously created here. */
        removeById(lightId: number): boolean {
            try {
                const ns = g()?.api?.lights?.temporary;
                const fn = ns?.removeById;
                if (typeof fn !== "function") return false;
                fn.call(ns, lightId);
                return true;
            } catch (e) {
                console.warn(`${LOG} lights.temporary.removeById failed`, lightId, e);
                return false;
            }
        },
    };
}

/** Persistent lights: no id, removed by position. */
function persistentLights() {
    return {
        /**
         * Create a persistent light at world coordinates.
         *
         * Returns nothing — persistent lights are tracked by position and
         * removed with {@link persistentLights.removeAtWorld}.
         */
        createAtWorld(
            worldX: number,
            worldY: number,
            options?: LightOptions,
        ): boolean {
            try {
                const ns = g()?.api?.lights?.persistent;
                const fn = ns?.createAtWorld;
                if (typeof fn !== "function") return false;
                fn.call(ns, worldX, worldY, options);
                return true;
            } catch (e) {
                console.warn(`${LOG} lights.persistent.createAtWorld failed`, e);
                return false;
            }
        },

        /** Remove the persistent light at a world position. */
        removeAtWorld(worldX: number, worldY: number): boolean {
            try {
                const ns = g()?.api?.lights?.persistent;
                const fn = ns?.removeAtWorld;
                if (typeof fn !== "function") return false;
                fn.call(ns, worldX, worldY);
                return true;
            } catch (e) {
                console.warn(
                    `${LOG} lights.persistent.removeAtWorld failed`,
                    worldX,
                    worldY,
                    e,
                );
                return false;
            }
        },

        /** Fade the persistent light out over a duration. */
        fadeAtWorld(worldX: number, worldY: number, durationMs?: number): boolean {
            try {
                const ns = g()?.api?.lights?.persistent;
                const fn = ns?.fadeAtWorld;
                if (typeof fn !== "function") return false;
                fn.call(ns, worldX, worldY, durationMs);
                return true;
            } catch (e) {
                console.warn(`${LOG} lights.persistent.fadeAtWorld failed`, e);
                return false;
            }
        },

        /** Flag persistent lights for a re-upload to the worker. */
        markDirty(): boolean {
            try {
                const ns = g()?.api?.lights?.persistent;
                const fn = ns?.markDirty;
                if (typeof fn !== "function") return false;
                fn.call(ns);
                return true;
            } catch (e) {
                console.warn(`${LOG} lights.persistent.markDirty failed`, e);
                return false;
            }
        },
    };
}

export const lights = {
    /** Short-lived lights, removed by id. */
    temporary: temporaryLights(),

    /**
     * Visual-effect lights.
     *
     * The facade exposes `lights.vfx` as the same object as
     * `lights.temporary` (`extra-mod-runtime.js` 1761-1764), so this is an
     * alias rather than a second, independent namespace.
     */
    vfx: temporaryLights(),

    /** Lights that persist until removed by position. */
    persistent: persistentLights(),
};