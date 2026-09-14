const api = sandkit.api;
import { ASTRO_ELEMENTS } from "../config/catalogue.ts";
import { MOD_ID } from "../config/ids.ts";

export const registerI18n = () => {
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
};
