/**
 * Live per-profile config read by the worker profile definitions.
 *
 * Reads pull the shared version counter first and decode JSON only when it
 * changes. Missing values use the typed `PROFILE_DEFAULTS` entry.
 */
import { JsonBuffer } from "@sandmd/buffer";
import { MOD_ID } from "../../ids.ts";
import {
    buildDefaultProfileRecord,
    PROFILE_BUFFER_ID,
    PROFILE_BUFFER_MAX_BYTES,
    PROFILE_DEFAULTS,
    type ProfileConfigRecord,
    type ProfileId,
    type ProfileRuntimeConfig,
    type ProfileRuntimeKey,
} from "../profileRuntime.ts";

/** Main-thread handle (the registerBufferControls buffer). Write + read. */
let mainBuffer: JsonBuffer<ProfileConfigRecord> | null = null;
/** Worker-side observe handle, created lazily. Read-only. */
let observeBuffer: JsonBuffer<ProfileConfigRecord> | null = null;

/**
 * Main thread: hand over the registerBufferControls buffer so `live` reads
 * through the same handle that owns picker writes and refreshes.
 */
export function setProfileBuffer(buffer: JsonBuffer<ProfileConfigRecord>): void {
    mainBuffer = buffer;
}

/** Lazily create the observe-mode buffer handle (worker never commits). */
export function profileBuffer(): JsonBuffer<ProfileConfigRecord> | null {
    if (mainBuffer) return mainBuffer;
    if (observeBuffer) return observeBuffer;
    try {
        observeBuffer = new JsonBuffer<ProfileConfigRecord>({
            key: PROFILE_BUFFER_ID,
            defaultRecord: buildDefaultProfileRecord(),
            maxBytes: PROFILE_BUFFER_MAX_BYTES,
            persist: true,
            loadFromStorage: false,
            observe: true,
        });
    } catch (e) {
        console.warn(`[${MOD_ID}] profile config buffer unavailable:`, e);
        return null;
    }
    return observeBuffer;
}

/**
 * Live read of one profile knob from the buffer, e.g.
 * `live(this.id, "tickSpeed")`. `key` is the buffer key
 * (`crystalEnabled`, not `crystallizationEnabled`).
 */
function isValidProfileValue(key: ProfileRuntimeKey, value: unknown): boolean {
    if (key === "enabled" || key === "growEnabled" || key === "crystalEnabled") {
        return typeof value === "boolean";
    }
    return typeof value === "number" && Number.isFinite(value);
}

export function live<K extends ProfileRuntimeKey>(
    profileId: ProfileId,
    key: K,
): ProfileRuntimeConfig[K] {
    const defaults = PROFILE_DEFAULTS[profileId];
    const buf = profileBuffer();
    if (!buf) return defaults[key];
    const value = buf.getPath(`P.${profileId}.${key}`);
    if (value === null || value === undefined) return defaults[key];
    if (!isValidProfileValue(key, value)) {
        throw new Error(`Invalid Astro profile value at P.${profileId}.${key}.`);
    }
    return value as ProfileRuntimeConfig[K];
}
