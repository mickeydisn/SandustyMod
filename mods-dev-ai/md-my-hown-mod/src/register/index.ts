/**
 * The one entry point. The config is read here and nowhere else.
 *
 * `registerAll` is the only function in this project allowed to call a
 * `register*`. The panel reads and writes the config and cannot reach the engine;
 * nothing re-applies after boot. That is not a style preference — the engine
 * syncs mod content to the simulation worker exactly once, so a later
 * registration is a definition the worker never hears of. `registry.ts` has the
 * evidence and the guard.
 *
 * It closes the boot window itself, so no caller can forget to, and a second
 * call is a no-op rather than the re-registration crash.
 */
import { LOG, type ModConfig } from "../constants.ts";
import { loadConfig } from "../config/store.ts";
import { registerElements } from "./elements.ts";
import { registerStructures } from "./structures.ts";
import { registerTerrains } from "./terrains.ts";
import { registerTheRest } from "./the-rest.ts";
import { closeBootWindow } from "./registry.ts";

export interface RegisterCounts {
    elements: number;
    structures: number;
    terrains: number;
    /** Every other category, keyed by its config key (`items`, `recipes`, …). */
    rest: Record<string, number>;
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
    };
    closeBootWindow();
    console.log(
        `${LOG} registered: el${counts.elements} st${counts.structures} ` +
            `te${counts.terrains} ` +
            Object.entries(counts.rest).map(([k, v]) => `${k}${v}`).join(" "),
    );
    return counts;
}
