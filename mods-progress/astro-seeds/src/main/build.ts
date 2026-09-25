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
import { MOD_ID, VERSION } from "../ids.ts";
import { ElementType } from "../config/elementShared/resolve.ts";
import { safe } from "../config/elementShared/util.ts";
import { setProfileBuffer } from "../config/elementWorker/live.ts";
import {
    buildDefaultProfileRecord,
    PROFILE_BUFFER_ID,
    PROFILE_BUFFER_MAX_BYTES,
    PROFILE_INITIAL_ITEM_ID,
    PROFILE_SPRITES,
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
        }), null);

    // Live profile configuration — one placeable structure per buffer path
    // (profiles.<id>.tickSpeed / .enabled / .growEnabled / .crystalEnabled).
    // The worker observes the same JsonBuffer and applies it in real time.
    // The returned buffer is handed to the live config module so mod code can
    // also write profile values programmatically (`write(...)` in live.ts).
    registerBufferControls<ProfileConfigRecord>({
        modId: MOD_ID,
        bufferId: PROFILE_BUFFER_ID,
        defaultRecord: buildDefaultProfileRecord(),
        maxBytes: PROFILE_BUFFER_MAX_BYTES,
        storage: { persist: true, load: true },
        pathScan: { maxDepth: 8, includeContainers: true },
        menuItemId: `${MOD_ID}:bufferProfile:menu`,
        initialItemId: PROFILE_INITIAL_ITEM_ID,
        menu: {
            label: "Astro Profiles",
            description: "Astro Profiles — opens the per-profile config picker.",
            spriteId: "menu",
        },
        categories: PROFILES_CONFIG,
        categoryForPath: (path) => {
            const parts = path.split(".");
            if (parts[0] !== "P" || parts.length < 2 || parts[1] === "") {
                throw new Error(`Unexpected Astro profile path: ${path}`);
            }
            return parts[1];
        },
        // Sprite list — each entry owns its asset file (there is no separate
        // file table any more). Matching order per catalogue item:
        // itemId → tag → action + kind → kind alone, so the generic art below
        // is overridden per knob by PROFILE_SPRITES' `tag` entries.
        sprites: [
            // Menu entry: resolved through `menu.spriteId`, not by matching.
            { spriteId: "menu", filePath: "assets/types/display.png" },
            { kind: "string", spriteId: "string", filePath: "assets/types/string.png" },

            {
                kind: "number",
                action: "dec",
                spriteId: "actionMinus",
                filePath: "assets/types/minus.png",
            },
            {
                kind: "number",
                action: "decX",
                spriteId: "actionMinusX",
                filePath: "assets/types/minusX.png",
            },
            {
                kind: "number",
                action: "inc",
                spriteId: "actionPlus",
                filePath: "assets/types/plus.png",
            },
            {
                kind: "number",
                action: "incX",
                spriteId: "actionPlusX",
                filePath: "assets/types/plusX.png",
            },
            { kind: "number", spriteId: "number", filePath: "assets/types/number.png" },

            {
                kind: "bool",
                action: "toggle",
                spriteId: "actionToggle",
                filePath: "assets/types/toggle.png",
            },
            { kind: "bool", spriteId: "bolean", filePath: "assets/types/bolean.png" },

            // No generic `toggleNum` / `toggleRate` entries here: a number only
            // gets a toggle behaviour where PROFILE_SPRITES declares one for
            // that knob (`*-weigth.png` → `toggleNum`, `*-rate.png` →
            // `toggleRate` with its `frames` count).
            // …overridden knob-by-knob with the mod's own art.
            ...PROFILE_SPRITES,
        ],
        unmappedCategoryColor: "#FFFFFF",
        picker: {
            id: `${MOD_ID}:bufferProfile:picker`,
            slot: "hotbar",
            title: "Astro profile config",
            persistSelection: true,
        },
    })
        .then(({ buffer }) => setProfileBuffer(buffer))
        .catch((e) => console.warn(`[${MOD_ID}] buffer controls failed:`, e));

    console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}
