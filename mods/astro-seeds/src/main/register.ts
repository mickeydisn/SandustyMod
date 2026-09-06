/**
 * Main-thread entry — elements, reactions, config panel.
 */
import { MOD_ID } from "../shared/ids.ts";
import { elementConfig } from "../shared/elementConfig.ts";
import { ElementType } from "./elementResolve.ts";
import { TElementTypeKey } from "../shared/elementTypes.ts";
import { safe } from "../shared/utils.ts";

const api = sandkit.api;

export const registerElement = () => {
  // Register Elements
  for (const [key, conf] of Object.entries(elementConfig)) {
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
    ElementType[key as TElementTypeKey] = elementTypeId;
    api.discoveries.addElementByType(elementTypeId);
  }

  // Reaction
  api.reactions.registerContact({
    inputA: ElementType.seedBase,
    inputB: ElementType.voidPetal,
    outputA: ElementType.astroVoidSeed,
    outputB: null,
  });
  api.reactions.registerContact({
    inputA: ElementType.astroVoidSeed,
    inputB: ElementType.florinol,
    outputA: ElementType.astroSeed,
    outputB: null,
  });
  api.reactions.registerContact({
    inputA: ElementType.astroGoldCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroGoldPowder,
    outputB: ElementType.fire,
  });
  api.reactions.registerContact({
    inputA: ElementType.astroCopperCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroCopperPowder,
    outputB: ElementType.fire,
  });
  api.reactions.registerContact({
    inputA: ElementType.astroWaterCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroWaterPowder,
    outputB: ElementType.fire,
  });
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
