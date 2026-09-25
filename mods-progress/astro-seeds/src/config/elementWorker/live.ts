/**
 * Live per-profile config — read (and write, main thread only) the
 * profile-config buffer from directly inside the Profile literals.
 *
 * Reads (`live`) work on every thread: they pull the shared version counter
 * first (one Atomics check) and re-decode the JSON only when the version
 * changed. If an older persisted record is missing a path, the value comes
 * from the typed `PROFILE_DEFAULTS` entry for that profile.
 *
 * Writes (`write`) are main-thread only and go through the JsonBuffer instance
 * owned by `registerBufferControls` (set via `setProfileBuffer`), so storage
 * persistence and the picker/value-structure refresh keep a single owner. The
 * worker's handle is observe-mode and must never commit.
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
 * through it and `write` commits through it (storage + refresh stay owned by
 * buffer-controls).
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

/**
 * Main-thread write of one profile knob, e.g.
 * `write("astroSeed-in-water", "tickSpeed", 80)`. Commits to shared memory
 * (the worker sees it on its next `live` read) and to storage on the next
 * `store:save`. No-op with a warning on the worker or before
 * `setProfileBuffer` has been called.
 */
export function write<K extends ProfileRuntimeKey>(
    profileId: ProfileId,
    key: K,
    value: ProfileRuntimeConfig[K],
): boolean {
    if (!mainBuffer) {
        console.warn(
            `[${MOD_ID}] profile config write ignored (${profileId}.${key}) — call setProfileBuffer() on the main thread first`,
        );
        return false;
    }
    mainBuffer.setPath(`P.${profileId}.${key}`, value);
    mainBuffer.commit();
    return true;
}
