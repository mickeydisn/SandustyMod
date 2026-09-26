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
import { elementDefinition } from "./element.ts";
import { itemDefinition } from "./item.ts";
import { structureDefinition } from "./structure.ts";
import { terrainDefinition } from "./terrain.ts";
import type { Definition, Tab } from "./types.ts";

/**
 * Every object definition, keyed by the tab that reaches it.
 *
 * Adding an object is one line here plus one file beside it.
 */
export const DEFINITIONS: Partial<Record<Tab, Definition>> = {
    elements: elementDefinition,
    items: itemDefinition,
    structures: structureDefinition,
    terrains: terrainDefinition,
};

/**
 * The definition for a tab, or `undefined` when the tab is a view or has not
 * been split out yet.
 */
export function definitionFor(cat: Tab): Definition | undefined {
    return DEFINITIONS[cat];
}
