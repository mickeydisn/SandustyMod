/**
 * The one entry point. The config is read here and nowhere else.
 *
 * `registerAll` is the only function in this project allowed to call a
 * `register*`. The panel reads and writes the config and cannot reach the engine;
 * nothing re-applies after boot. That is not a style preference — the engine syncs
 * mod content to the simulation worker exactly once, so a later registration is a
 * definition the worker never hears of. `registry.ts` has the evidence and the
 * guard.
 *
 * It closes the boot window itself, so no caller can forget to, and a second call
 * is a no-op rather than the re-registration crash.
 *
 * ## Two kinds of stored entry
 *
 * The directory is split because the categories in it are not the same kind of
 * thing, and the difference decides what a missing registration *means*.
 *
 *   - **`core/`** — real engine objects. Each ends in a `register*` call and is
 *     missed by the engine if this code does not run.
 *   - **`custom/`** — mod-owned. Real tabs, real ids, real config, and the engine
 *     never receives them. Nothing here is *missing* from the engine, because there
 *     is nothing there to miss.
 *
 * `energyNetworks` is the clearest case: a scan of the engine bundle finds no
 * `registerNetwork` and no `"power"` / `"network"` string literal — the engine
 * resolves a network by flood-filling connected tiles from a coordinate. A network
 * name is a vocabulary this mod owns, not a declaration the engine holds.
 */

import { LOG, type ModConfig } from "../constants.ts";
import { loadConfig } from "../config/store.ts";
import { registerElements } from "./core/elements.ts";
import { registerStructures } from "./core/structures.ts";
import { registerTerrains } from "./core/terrains.ts";
import { registerTheRest } from "./the-rest.ts";
import { installElementPickerVisibility } from "./core/element-picker.ts";
import { closeBootWindow } from "./registry.ts";

export interface RegisterCounts {
    elements: number;
    structures: number;
    terrains: number;
    /** Every other category, keyed by its config key (`items`, `recipes`, …). */
    rest: Record<string, number>;
    /**
     * Element types withheld from the vacuum by the picker hook.
     *
     * Reported rather than assumed, so a boot that hides nothing says so — the
     * hook is skipped entirely in that case, and silently installing a no-op one
     * would invalidate the engine's mask cache for no reason.
     */
    hiddenElements: number;
}

/**
 * Register the stored config and close the boot window.
 *
 * Closes the window itself rather than leaving it to the caller, so no caller can
 * forget — and a second call is a no-op rather than a crash.
 */
export function registerAll(cfg?: ModConfig): RegisterCounts {
    const config = cfg ?? loadConfig();
    const counts: RegisterCounts = {
        elements: registerElements(config),
        // Structures before terrains and items: those may reference a structure.
        structures: registerStructures(config),
        terrains: registerTerrains(config),
        rest: registerTheRest(config),
        // After the elements, because it works from the types `registerElements`
        // was just assigned, and before the window closes because the engine
        // builds the vacuum's mask lazily and caches it — anything that changes
        // it has to be in place by the time that first happens.
        hiddenElements: installElementPickerVisibility(),
    };
    closeBootWindow();
    console.log(
        `${LOG} registered: el${counts.elements} st${counts.structures} ` +
            `te${counts.terrains} hidden${counts.hiddenElements} ` +
            Object.entries(counts.rest).map(([k, v]) => `${k}${v}`).join(" "),
    );
    return counts;
}
