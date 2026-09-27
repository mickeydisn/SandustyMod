/**
 * The per-object list panels.
 *
 * One file per object that has something to say in its list, and an index that
 * the shared screen looks the object up in. Kept beside `list-panel.ts` — which
 * holds the frame every object shares — so the split reads as "what the frame
 * does" versus "what this object says about itself".
 *
 * An object with no entry here is not a gap. Most objects in the panel really
 * are a list of names, and the shared renderers draw them correctly. A file
 * exists only where an object can say something the frame cannot: a colour, a
 * footprint, a type that decides which fields matter.
 */
import { elementList } from "./element.ts";
import { itemList } from "./item.ts";
import { structureList } from "./structure.ts";
import { terrainList } from "./terrain.ts";
import type { DefinitionList } from "../definition/types.ts";
import type { Tab } from "../definition/types.ts";

/** Each object's list behaviour, by the tab that reaches it. */
export const LISTS: Partial<Record<Tab, DefinitionList>> = {
    elements: elementList,
    items: itemList,
    structures: structureList,
    terrains: terrainList,
};

/** An object's list behaviour, or `undefined` for one that has nothing to add. */
export function listFor(tab: Tab): DefinitionList | undefined {
    return LISTS[tab];
}
