/**
 * Main-thread entry — registers the astro catalogue through the shared
 * element-profiles main builder, then adds the mod's own UI touch.
 *
 * The builder derives i18n keys (`<id>|name`, `<id>|description`), registers
 * every element + discovery, wires the contact reactions and attaches the tech
 * node to the first vanilla tech that exists.
 */
import { buildElementMain } from "@sandmd/element-profiles/main";
import { registerBufferControls } from "@sandmd/buffer-controls";
import { ASTRO_ELEMENTS } from "../config/elementMain/catalogue.ts";
import { MOD_ID, VERSION } from "../config/elementShared/ids.ts";
import { ElementType } from "../config/elementShared/resolve.ts";
import { safe } from "../config/elementShared/util.ts";
import { setProfileBuffer } from "../config/elementWorker/live.ts";
import {
    buildDefaultProfileRecord,
    PROFILE_BUFFER_ID,
    type ProfileConfigRecord,
    PROFILES_CONFIG,
} from "../config/profileRuntime.ts";

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

    // Live profile configuration — one placeable structure per buffer path
    // (profiles.<id>.tickSpeed / .enabled / .growEnabled / .crystalEnabled).
    // The worker observes the same JsonBuffer and applies it in real time.
    // The returned buffer is handed to the live config module so mod code can
    // also write profile values programmatically (`write(...)` in live.ts).
    registerBufferControls<ProfileConfigRecord>({
        modId: MOD_ID,
        bufferId: PROFILE_BUFFER_ID,
        defaultRecord: buildDefaultProfileRecord(),
        menuItemId: `${MOD_ID}:bufferProfile:menu`,
        menu: {
            label: "Astro Profiles",
            description: "Astro Profiles — opens the per-profile config picker.",
            spriteId: "menu",
        },
        categories: PROFILES_CONFIG,
        sprites: [
            { itemId: `${MOD_ID}:bufferProfile:menu`, spriteId: "menu" },
            { kind: "string", spriteId: "string" },

            { kind: "number", action: "dec", spriteId: "actionMinus" },
            { kind: "number", action: "decX", spriteId: "actionMinusX" },
            { kind: "number", action: "inc", spriteId: "actionPlus" },
            { kind: "number", action: "incX", spriteId: "actionPlusX" },
            { kind: "number", spriteId: "number" },

            { kind: "bool", action: "toggle", spriteId: "actionToggle" },
            { kind: "bool", spriteId: "bolean" },
        ],
        spriteFiles: [
            { id: "number", filePath: "assets/types/number.png" },
            { id: "bolean", filePath: "assets/types/bolean.png" },
            { id: "string", filePath: "assets/types/string.png" },
            { id: "menu", filePath: "assets/types/display.png" },
            { id: "actionPlus", filePath: "assets/types/plus.png" },
            { id: "actionMinus", filePath: "assets/types/minus.png" },
            { id: "actionPlusX", filePath: "assets/types/plusX.png" },
            { id: "actionMinusX", filePath: "assets/types/minusX.png" },
            { id: "actionToggle", filePath: "assets/types/toggle.png" },
        ],
        pickerTitle: "Astro profile config",
        persist: true,
        persistLoad: false,
    })
        .then(({ buffer }) => setProfileBuffer(buffer))
        .catch((e) => console.warn(`[${MOD_ID}] buffer controls failed:`, e));

    console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}
