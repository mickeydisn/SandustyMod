/**
 * Terrain registration.
 *
 * Worker-scoped, like elements — a terrain the worker has never heard of is an
 * unknown type that does not move. See `registry.ts`.
 *
 * Terrain registers from this module, and `terrains` is declared in the registry's
 * `registered` map — a missing key returns `undefined` and silently skips the
 * double-registration guard, which is the crash.
 */
import type { ModConfig } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { registerTerrain } from "../../packages/registrations.ts";
import { mayRegister, registered } from "../registry.ts";

/**
 * Register every terrain in `cfg`.
 *
 * Safe to call repeatedly — ids already registered are skipped — and refuses to
 * register after the boot window has shut, because a terrain the worker never
 * received is one that will not move and cannot be repaired without a reload.
 */
export function registerTerrains(cfg?: ModConfig): number {
    const config = cfg ?? loadConfig();
    let n = 0;
    for (const t of config.terrains ?? []) {
        if (!t?.id) continue;
        if (registered.terrains.has(t.id)) continue;
        if (!mayRegister("terrains", t.id)) continue;
        registerTerrain(t);
        registered.terrains.add(t.id);
        n++;
    }
    return n;
}
