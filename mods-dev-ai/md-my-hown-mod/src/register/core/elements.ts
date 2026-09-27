/**
 * Element registration.
 *
 * Worker-scoped, so everything here runs inside the boot window that
 * `registerAll` opens and closes — see `registry.ts` for why that window is the
 * only moment an element can be given physics.
 *
 * The one thing specific to elements: a `matterType` that is not a number
 * resolves to nothing in the worker's physics table, so the cells are created and
 * then never move. Nothing throws, and nothing is logged by the engine, so
 * `registerElements` logs the resolved value on every registration.
 */
import { LOG, type ModConfig } from "../../constants.ts";
import { loadConfig } from "../../config/store.ts";
import { api, normalizeElementPatch } from "../../packages/mysandkit.ts";
import { isBootWindowOpen, registered } from "../registry.ts";
import { noteElementVisibility } from "./element-picker.ts";

export { closeBootWindow } from "../registry.ts";
export { __resetBootWindowForTests } from "../registry.ts";

/**
 * Register every element in `cfg` (default: the stored config).
 *
 * Called once, inside the boot window, by `registerAll`. An id already in the
 * shared guard is skipped, and a closed window registers nothing — a new element
 * would not reach the worker and an existing one would fork its type. See
 * `registry.ts`.
 */
export function registerElements(cfg?: ModConfig): number {
    const config = cfg ?? loadConfig();
    let n = 0;
    for (const el of config.elements ?? []) {
        if (!el?.id) continue;
        if (registered.elements.has(el.id)) continue;
        if (!isBootWindowOpen()) continue;
        const res = api.elements.register(el);
        if (res === undefined) continue;
        registered.elements.add(el.id);
        n++;
        const type = res.elementType;
        if (typeof type === "number") api.elements.addElementToDiscoveries(type);
        // Hand the assigned type to the picker module. This is the only moment an
        // id can be tied to a type — the engine hands out the type here and
        // nowhere else — so a `visibleInPicker: false` recorded any later would
        // have nothing to match `args.elementType` against.
        noteElementVisibility(type, el as Record<string, unknown>);
        // The one thing about an element that is invisible when it is wrong: the
        // worker resolves physics by `ce[def.matterType]`, and a `matterType` that
        // is not a number matches nothing, so the cells are created and then never
        // move. Nothing throws and nothing is logged by the engine. One line here
        // turns "it just sits there" into something the console can answer.
        //
        // Read back off the same normaliser `register` uses, so the number printed
        // is the number the engine gets rather than a second guess at it.
        const normalised = normalizeElementPatch(el as Record<string, unknown>);
        console.log(
            `${LOG} element ${el.id} type=${type} matterType ` +
                `${JSON.stringify((el as { matterType?: unknown }).matterType)} ` +
                `-> ${JSON.stringify(normalised.matterType)}`,
        );
    }
    return n;
}
