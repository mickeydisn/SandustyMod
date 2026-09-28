/**
 * The definition registry — the one place the panel asks "what is this tab?".
 *
 * `schema.ts` and `panel.ts` each hold a piece of every object, and holding them
 * apart is the problem this replaces: the field list here, a widget there, a save
 * case in a switch. A definition is those three things together, so this is where
 * the assembled list lives and where a new object gets added.
 *
 * A tab with no entry here is not an error — several tabs are views rather than
 * forms (`json`, `map`, `help`, `handlers`, `draws`) and own nothing. So the
 * lookups return `undefined` and each caller decides what that means, rather than
 * the registry inventing an empty definition that would look like a real one.
 *
 * Definitions are split by *who owns the object*, and the two folders answer
 * different questions:
 *
 *   - `./core/` — the engine has a first-class object for it, with a `register()`
 *     and a documented shape. Renaming one would be renaming something the game
 *     already knows.
 *   - `./custom/` — the mod invented the object and the engine only ever sees the
 *     *strings* it resolves to. Neither is a thing `register()` receives, which is
 *     why they cannot be documented by an engine API.
 *
 * The test is not "is this useful" or "is this complex" — `network` is two fields
 * and lives in `custom`, `structure` is the widest tab and lives in `core`. It is
 * whether the game has heard of the object itself.
 */
import { behaviorDefinition } from "./core/behavior.ts";
import { contactDefinition } from "./core/contact.ts";
import { elementDefinition } from "./core/element.ts";
import { energyDefinition } from "./core/energy.ts";
import { excavationDefinition } from "./core/excavation.ts";
import { inputDefinition } from "./core/input.ts";
import { interactionDefinition } from "./core/interaction.ts";
import { itemDefinition } from "./core/item.ts";
import { modifierDefinition } from "./core/modifier.ts";
import { processingDefinition } from "./core/processing.ts";
import { projectileDefinition } from "./core/projectile.ts";
import { recipeDefinition } from "./core/recipe.ts";
import { signalDefinition } from "./core/signal.ts";
import { spriteDefinition } from "./core/sprite.ts";
import { structureDefinition } from "./core/structure.ts";
import { techDefinition } from "./core/tech.ts";
import { terrainDefinition } from "./core/terrain.ts";
import { triggerDefinition } from "./core/trigger.ts";
import { upgradeDefinition } from "./core/upgrade.ts";
import { upgradeCategoryDefinition } from "./core/upgrade-category.ts";
import { customProcessDefinition } from "./custom/process.ts";
import { networkDefinition } from "./custom/network.ts";
import { unlockNodeDefinition } from "./custom/unlock-node.ts";
import type { Definition, Tab } from "./types.ts";

/**
 * Every object definition, keyed by the tab that reaches it.
 *
 * Adding an object is one file beside its folder and one line here. Which
 * folder it goes in is the ownership question in the note above: an engine
 * object in `core`, a mod-owned one in `custom`.
 */
export const DEFINITIONS: Partial<Record<Tab, Definition>> = {
    behaviors: behaviorDefinition,
    customProcess: customProcessDefinition,
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
