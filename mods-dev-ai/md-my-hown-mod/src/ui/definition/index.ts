/**
 * The definition registry — the one place the panel asks "what is this tab?".
 *
 * `schema.ts` and `panel.ts` both used to hold a piece of every object: the
 * field list here, a widget there, a save case in a switch. A definition is
 * those three things together, so this is where the assembled list lives and
 * where a new object gets added.
 *
 * A tab with no entry here is not an error — several tabs are views rather than
 * forms (`json`, `map`, `help`, `handlers`, `draws`) and own nothing. So the
 * lookups return `undefined` and each caller decides what that means, rather
 * than the registry inventing an empty definition that would look like a real
 * one with no fields.
 */
import { behaviorDefinition } from "./behavior.ts";
import { contactDefinition } from "./contact.ts";
import { elementDefinition } from "./element.ts";
import { energyDefinition } from "./energy.ts";
import { excavationDefinition } from "./excavation.ts";
import { inputDefinition } from "./input.ts";
import { interactionDefinition } from "./interaction.ts";
import { itemDefinition } from "./item.ts";
import { modifierDefinition } from "./modifier.ts";
import { networkDefinition } from "./network.ts";
import { processingDefinition } from "./processing.ts";
import { projectileDefinition } from "./projectile.ts";
import { recipeDefinition } from "./recipe.ts";
import { signalDefinition } from "./signal.ts";
import { spriteDefinition } from "./sprite.ts";
import { structureDefinition } from "./structure.ts";
import { techDefinition } from "./tech.ts";
import { terrainDefinition } from "./terrain.ts";
import { triggerDefinition } from "./trigger.ts";
import { unlockNodeDefinition } from "./unlock-node.ts";
import { upgradeDefinition } from "./upgrade.ts";
import { upgradeCategoryDefinition } from "./upgrade-category.ts";
import type { Definition, Tab } from "./types.ts";

/**
 * Every object definition, keyed by the tab that reaches it.
 *
 * Adding an object is one line here plus one file beside it.
 */
export const DEFINITIONS: Partial<Record<Tab, Definition>> = {
    behaviors: behaviorDefinition,
    categories: upgradeCategoryDefinition,
    contacts: contactDefinition,
    elements: elementDefinition,
    energy: energyDefinition,
    excavation: excavationDefinition,
    inputs: inputDefinition,
    interactions: interactionDefinition,
    items: itemDefinition,
    modifiers: modifierDefinition,
    networks: networkDefinition,
    processing: processingDefinition,
    projectiles: projectileDefinition,
    recipes: recipeDefinition,
    signals: signalDefinition,
    sprites: spriteDefinition,
    structures: structureDefinition,
    techs: techDefinition,
    terrains: terrainDefinition,
    triggers: triggerDefinition,
    unlockNodes: unlockNodeDefinition,
    upgrades: upgradeDefinition,
};

/**
 * The definition for a tab, or `undefined` when the tab is a view or has not
 * been split out yet.
 */
export function definitionFor(cat: Tab): Definition | undefined {
    return DEFINITIONS[cat];
}
