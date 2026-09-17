/**
 * Main-thread entry — registers the astro catalogue through the shared
 * element-profiles main builder, then adds the mod's own UI touch.
 *
 * The builder derives i18n keys (`<id>|name`, `<id>|description`), registers
 * every element + discovery, wires the contact reactions and attaches the tech
 * node to the first vanilla tech that exists.
 */
import { buildElementMain } from "@sandmd/element-profiles/main";
import { ASTRO_ELEMENTS } from "../config/elementMain/catalogue.ts";
import { MOD_ID, VERSION } from "../config/elementShared/ids.ts";
import { ElementType } from "../config/elementShared/resolve.ts";
import { safe } from "../config/elementShared/util.ts";

export function buildMain(): void {
    const api = sandkit.api;

    const { types } = buildElementMain({
        elements: ASTRO_ELEMENTS,
        // Vanilla keys the reactions reference (water, fire, florinol, …).
        types: ElementType,
        tech: {
            id: `${MOD_ID}:astro-seeds`,
            nameKey: `${MOD_ID}.tech.name`,
            descriptionKey: `${MOD_ID}.tech.description`,
            name: "Astro Seeds",
            description: "Seed–crystal profiles over liquids.",
            cost: 4500,
            parents: ["SteamTurbine", "KineticPress"],
        },
    });

    // Mirror the engine-assigned ids onto the shared key → type map.
    Object.assign(ElementType, types);

    // Welcome toast once the world is ready.
    safe(() =>
        api.events.on("game:ready", () => {
            api.ui.toast(`Astro Seeds v${VERSION}`, {});
        })
    );
    console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}
