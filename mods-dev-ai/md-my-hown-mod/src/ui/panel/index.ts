/**
 * The panel's screens, and the objects that decorate them.
 *
 * Two kinds of file live here, and the split is worth keeping straight:
 *
 *   - `list.ts` holds the frame every list shares, and `draws`/`handlers`/`help`
 *     are whole screens in their own right.
 *   - `element`/`item`/`structure`/`terrain` are one file per object that has
 *     something to say in its list, and `LISTS` is how the shared screen looks
 *     the object up. `list.ts` is their frame, so the split reads as "what the
 *     frame does" versus "what this object says about itself".
 *
 * An object with no entry in `LISTS` is not a gap. Most objects in the panel
 * really are a list of names, and the shared renderers draw them correctly. A
 * file exists only where an object can say something the frame cannot: a
 * colour, a footprint, a type that decides which fields matter.
 */
import { elementList } from "./element.ts";
import { itemList } from "./item.ts";
import { structureList } from "./structure.ts";
import { terrainList } from "./terrain.ts";
import type { DefinitionList, Tab } from "../definition/types.ts";

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
