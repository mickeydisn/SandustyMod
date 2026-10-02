import { elementList } from "./element.ts";
import { itemList } from "./item.ts";
import { structureList } from "./structure.ts";
import { terrainList } from "./terrain.ts";
import type { DefinitionList, Tab } from "../definition/types.ts";

export const LISTS: Partial<Record<Tab, DefinitionList>> = {
    elements: elementList,
    items: itemList,
    structures: structureList,
    terrains: terrainList,
};

export function listFor(tab: Tab): DefinitionList | undefined {
    return LISTS[tab];
}
