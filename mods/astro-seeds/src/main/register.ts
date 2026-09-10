/**
 * Main-thread registration — elements, reactions, tech.
 * All content derives from the grouped catalogues (no inline element data).
 */
import { MOD_ID } from "../shared/ids.ts";
import { ASTRO_ELEMENTS, ASTRO_REACTIONS } from "../shared/elements/index.ts";
import { ElementType } from "../shared/elements/index.ts";
import { safe } from "../shared/utils.ts";

const api = sandkit.api;

export const registerElement = () => {
    // Register elements in catalogue order.
    for (const conf of ASTRO_ELEMENTS) {
        const elementTypeId = api.elements.register({
            id: conf.id,
            nameKey: `${conf.id}|name`,
            descriptionKey: `${conf.id}|description`,
            colors: { variants: conf.colors },
            density: conf.density,
            metaColor: conf.metaColor,
            matterType: conf.matterType,
        }).elementType;
        console.log("Register", conf, elementTypeId);
        ElementType[conf.key] = elementTypeId;
        api.discoveries.addElementByType(elementTypeId);
    }

    // Reactions from the grouped reaction catalogue.
    for (const r of ASTRO_REACTIONS) {
        api.reactions.registerContact({
            inputA: ElementType[r.inputA],
            inputB: ElementType[r.inputB],
            outputA: r.outputA ? ElementType[r.outputA] : null,
            outputB: r.outputB ? ElementType[r.outputB] : null,
        });
    }
};

// REGISTER TECH
try {
    const parent = safe(() => sandkit.enums?.Tech?.SteamTurbine) ||
        safe(() => sandkit.enums?.Tech?.KineticPress) ||
        null;
    if (parent != null) {
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
} catch {
    /* ignore */
}
