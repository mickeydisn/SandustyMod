/**
 * Main-thread builder — turns the ASTRO_ELEMENTS catalogue into live content:
 * i18n, element + discovery registration, contact reactions and the tech node.
 *
 * Everything this mod registers derives from the catalogue; there is no other
 * source of truth. Resolved type ids are stashed onto `ElementType` so the
 * worker thread (which shares the module) sees the same numbers.
 */
import { ASTRO_ELEMENTS, ASTRO_REACTIONS } from "../config/catalogue.ts";
import { MOD_ID, VERSION } from "../config/ids.ts";
import { ElementType } from "../shared/resolve.ts";
import { safe } from "../shared/utils.ts";

const api = sandkit.api;

function registerI18n(): void {
    api.i18n.register("en", {
        [`${MOD_ID}.tech.name`]: "Astro Seeds",
        [`${MOD_ID}.tech.description`]: "Seed–crystal profiles over liquids.",
    });

    for (const conf of ASTRO_ELEMENTS) {
        api.i18n.register("en", {
            [`${conf.spec.id}|name`]: conf.spec.name,
            [`${conf.spec.id}|description`]: conf.spec.description,
        });
    }
}

function registerElements(): void {
    // Elements in catalogue order, then the contact reactions described by keys.
    for (const confEl of ASTRO_ELEMENTS) {
        const conf = confEl.spec;
        const elementTypeId = api.elements.register({
            id: conf.id,
            nameKey: `${conf.id}|name`,
            descriptionKey: `${conf.id}|description`,
            colors: { variants: conf.colors },
            density: conf.density,
            metaColor: conf.metaColor,
            matterType: conf.matterType,
        }).elementType;
        ElementType[conf.key] = elementTypeId;
        api.discoveries.addElementByType(elementTypeId);
    }

    for (const r of ASTRO_REACTIONS) {
        api.reactions.registerContact({
            inputA: ElementType[r.inputA],
            inputB: ElementType[r.inputB],
            outputA: r.outputA ? ElementType[r.outputA] : null,
            outputB: r.outputB ? ElementType[r.outputB] : null,
        });
    }
}

function registerTech(): void {
    const parent = safe(() => sandkit.enums?.Tech?.SteamTurbine) ||
        safe(() => sandkit.enums?.Tech?.KineticPress) ||
        null;
    if (parent == null) return;

    api.tech.registerNode(
        `${MOD_ID}:astro-seeds`,
        {
            nameKey: `${MOD_ID}.tech.name`,
            descriptionKey: `${MOD_ID}.tech.description`,
            cost: 4500,
        },
        { parentId: parent as number },
    );
}

export function buildMain(): void {
    registerI18n();
    registerElements();
    registerTech();

    // Welcome toast once the world is ready.
    safe(() =>
        api.events.on("game:ready", () => {
            api.ui.toast(`Astro Seeds v${VERSION}`, {});
        })
    );
    console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}
