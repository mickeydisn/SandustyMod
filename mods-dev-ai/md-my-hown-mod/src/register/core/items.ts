/**
 * Item registration.
 *
 * Items are the counter-example that makes the worker rule worth stating
 * precisely: an item is **not** worker-scoped. The simulation never needs an
 * item's definition, and the engine has no `RegisterModItems` message, so an item
 * registered at boot is genuinely live. That is invisible at a call site, which
 * is why it is written down here.
 */
import type { ModConfig } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api } from "../../packages/mysandkit.ts";
import { mayRegister, registered } from "../registry.ts";

/**
 * Register every item in `cfg`.
 *
 * Safe to call repeatedly: ids already registered are skipped, so a boot pass
 * and a later panel "Apply" cannot register the same item twice.
 */
export function registerItems(cfg?: ModConfig): number {
    const config = cfg ?? loadConfig();
    let n = 0;
    for (const it of config.items ?? []) {
        if (!it?.id) continue;
        if (registered.items.has(it.id)) continue;
        // Not worker-scoped, so this is always true — and deliberately still
        // called, so that adding "items" to WORKER_SCOPED cannot silently make
        // late registrations unsafe again.
        if (!mayRegister("items", it.id)) continue;
        api.items.register(it);
        registered.items.add(it.id);
        n++;
    }
    return n;
}
