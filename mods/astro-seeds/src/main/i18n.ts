const api = sandkit.api;
import { elementConfig } from "../shared/elementConfig.ts";
import { MOD_ID } from "../shared/ids.ts";

export const registerI18n = () => {
  api.i18n.register("en", {
    [`${MOD_ID}.tech.name`]: "Astro Seeds",
    [`${MOD_ID}.tech.description`]: "Seed–crystal profiles over liquids.",
  });

  for (const [_, conf] of Object.entries(elementConfig)) {
    api.i18n.register("en", {
      [`${conf.id}|name`]: conf.name,
      [`${conf.id}|description`]: conf.description,
    });
  }
};
