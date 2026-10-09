import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

/**
 * Typed-array kind for a shared buffer.
 *
 * Mirrors the `type` field accepted by `workers.shared.create`
 * (`extra-mod-runtime.js` 2637-2640 uses `"uint8"`).
 */
export type SharedBufferType =
    | "uint8"
    | "int8"
    | "uint16"
    | "int16"
    | "uint32"
    | "int32"
    | "float32"
    | "float64";

/** Configuration for creating a shared buffer. */
export type SharedBufferConfig = {
    /** Element type of the backing array. */
    type: SharedBufferType;
    /** Number of elements. */
    length: number;
};

/** A shared, cross-worker typed array. */
export type SharedBuffer = {
    /** Opaque buffer handle. */
    buffer?: ArrayBufferView;
    length: number;
    [key: string]: unknown;
};

export const shared = {
    buffers: {
        /**
         * Create a shared buffer, or return the existing one for this key.
         *
         * Keys are namespaced per mod automatically, so two mods may use the
         * same key without colliding. The handle is also what
         * `structures.register`'s `render.spritesheet.frameBuffer.key` refers
         * to — that buffer must already exist, or registration throws
         * (`extra-mod-runtime.js` 764-767).
         */
        ensure(key: string, config: SharedBufferConfig): SharedBuffer | null {
            try {
                const ns = g()?.api?.shared?.buffers;
                const fn = ns?.ensure ?? ns?.create;
                if (typeof fn !== "function") return null;
                return (fn.call(ns, key, config) ?? null) as SharedBuffer | null;
            } catch (e) {
                console.warn(`${LOG} shared.buffers.ensure failed`, key, e);
                return null;
            }
        },

        /** Host alias of {@link buffers.ensure}. */
        create(key: string, config: SharedBufferConfig): SharedBuffer | null {
            return shared.buffers.ensure(key, config);
        },

        /**
         * Look up an existing buffer by key.
         *
         * Returns `undefined` when the key was never created — the buffer is
         * never implicitly created by a read.
         */
        get(key: string): SharedBuffer | undefined {
            try {
                const ns = g()?.api?.shared?.buffers;
                const fn = ns?.get;
                if (typeof fn !== "function") return undefined;
                return fn.call(ns, key) as SharedBuffer | undefined;
            } catch (e) {
                console.warn(`${LOG} shared.buffers.get failed`, key, e);
                return undefined;
            }
        },
    },
};