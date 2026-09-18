/**
 * Channel Pads — mod entry point.
 *
 * Ten 1×1 pads (channels 0–9). At most two pads per channel. Walk onto a
 * linked pad to fold to its twin, with a shared cooldown between jumps.
 *
 * This file only wires the modules together: i18n, sprite loads and the
 * register* calls. See `hooks.ts` / `pads.ts` for the runtime wiring.
 */
import "@sandmd/sandkit";
import { api } from "./api.ts";
import { CHANNELS, LOG, MOD } from "./constants.ts";
import { registerLifecycle, registerLimitHook, registerStep } from "./hooks.ts";
import { registerI18n, registerPads } from "./pads.ts";

/** Load each pad spritesheet, best-effort so one bad asset cannot abort boot. */
async function loadSprites(): Promise<void> {
    for (let ch = 0; ch < CHANNELS; ch++) {
        try {
            await api.sprites.loadFromMod(`${MOD}.img.${ch}`, `assets/pad-${ch}.png`);
        } catch (err) {
            console.warn(`${LOG} sprite ${ch} failed`, err);
        }
    }
}

async function boot(): Promise<void> {
    registerI18n();
    await loadSprites();
    registerPads();
    registerLimitHook();
    registerLifecycle();
    registerStep();
}

try {
    await boot();
} catch (err) {
    console.error(`${LOG} boot failed`, err);
}
