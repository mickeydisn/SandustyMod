/**
 * Big Brother — mod entry point.
 *
 * Camera channels with screen feeds. One camera per channel; click a camera to
 * swing its capture corner. Screens are painted on the overlay each frame
 * (structure `draw` cannot replace the Pixi tilemap).
 *
 * This file only wires the modules together: settings bootstrap, sprite loads
 * and the register* calls. See `structures.ts` for the runtime wiring.
 */
import "@sandmd/sandkit";
import { api, clampInt } from "./api.ts";
import {
    DEFAULT_CHANNELS,
    DEFAULT_ZONE_TILES,
    LOG,
    MAX_CHANNELS,
    MAX_ZONE_TILES,
    MIN_CHANNELS,
    MIN_ZONE_TILES,
    MOD,
} from "./constants.ts";
import { ensureFeed, rebuildChannelArrays } from "./feeds.ts";
import { runtime } from "./state.ts";
import {
    registerCapture,
    registerI18n,
    registerInteract,
    registerLifecycle,
    registerLimit,
    registerStructures,
} from "./structures.ts";
import type { SettingsValues } from "./types.ts";

/** Master switch; default true when the field is missing. */
function isEnabled(): boolean {
    try {
        const value = api.settings.get("isEnabled");
        return typeof value === "boolean" ? value : true;
    } catch {
        return true;
    }
}

/**
 * Apply a settings change: rebuild the channel arrays / feed size when the
 * relevant fields changed, then re-register so the new channel count takes
 * effect without a restart.
 */
function applySettings(values: SettingsValues): void {
    const channels = clampInt(values.channels, MIN_CHANNELS, MAX_CHANNELS);
    const zoneTiles = clampInt(values.zoneTiles, MIN_ZONE_TILES, MAX_ZONE_TILES);

    let changed = false;
    if (channels !== runtime.channels) {
        runtime.channels = channels;
        changed = true;
    }
    if (zoneTiles !== runtime.zoneTiles) {
        runtime.zoneTiles = zoneTiles;
        changed = true;
    }
    if (!changed) return;

    rebuildChannelArrays();
    registerStructures();
    registerI18n();
}

/** Read the persisted settings, falling back to the compiled defaults. */
function readSettings(): void {
    try {
        const all = api.settings.getAll();
        runtime.channels = clampInt(all.channels, MIN_CHANNELS, MAX_CHANNELS);
        runtime.zoneTiles = clampInt(all.zoneTiles, MIN_ZONE_TILES, MAX_ZONE_TILES);
    } catch {
        // Settings API may be absent; keep the compiled defaults.
        runtime.channels = DEFAULT_CHANNELS;
        runtime.zoneTiles = DEFAULT_ZONE_TILES;
    }
}

/** Load the sprite assets, ignoring individual failures. */
async function loadSprites(): Promise<void> {
    try {
        await api.sprites.loadFromMod(`${MOD}.screen`, "assets/screen.png");
    } catch (err) {
        console.warn(`${LOG} screen sprite failed`, err);
    }
    for (let ch = 0; ch < runtime.channels; ch++) {
        try {
            await api.sprites.loadFromMod(`${MOD}.cam.${ch}`, `assets/camera-${ch}.png`);
        } catch (err) {
            console.warn(`${LOG} camera ${ch} sprite failed`, err);
        }
        ensureFeed(ch);
    }
}

async function boot(): Promise<void> {
    readSettings();
    rebuildChannelArrays();
    registerI18n();

    // Sprites are best-effort so a load failure can never abort boot and block
    // structure registration.
    await loadSprites();

    registerStructures();
    registerLimit();
    registerInteract();
    registerLifecycle();
    registerCapture();

    try {
        api.settings.onChange((values) => {
            if (!isEnabled()) {
                // Mod disabled: stop capturing and drop every feed back to NO SIGNAL.
                for (let ch = 0; ch < runtime.channels; ch++) runtime.hadCopy[ch] = false;
                return;
            }
            applySettings(values);
        });
    } catch {
        // Settings API may be absent; live config changes are optional.
    }
}

try {
    await boot();
} catch (err) {
    console.error(`${LOG} boot failed`, err);
}
