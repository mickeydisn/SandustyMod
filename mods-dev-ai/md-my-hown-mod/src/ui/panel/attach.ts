/**
 * Which list is drawn under which.
 *
 * Every screen here is a list of definitions, and the menu used to disagree about
 * that: four "Content" tabs that name a *thing*, and five "Extend" tabs that only
 * ever qualify one. A tooltip is not a peer of an element — it is something an
 * element has. Splitting them cost a click to get from one to the other and left
 * the reader holding the pairing in their head.
 *
 * So an attached tab is drawn *under* the list of the thing it qualifies, and the
 * group that held them is gone.
 *
 * The tab itself still exists. A form, a validator and a save path are all
 * per-tab, and none of that changes just because the tab lost its menu chip. It is
 * still the active category while one of its entries is open — `parentOf` is what
 * the sub-nav and Back read to put the reader where they came from.
 */
import type { Tab } from "../definition/types.ts";

/** Content tab → the lists shown beneath it, in draw order. */
export const ATTACHED: Partial<Record<Tab, readonly Tab[]>> = {
    elements: ["interactions"],
    structures: ["behaviors", "signals"],
    items: ["excavation", "projectiles"],
};

/**
 * The inverse of `ATTACHED`, built from it rather than written out.
 *
 * Two tables would be two things to forget to update together, and the failure is
 * silent: the sub-nav highlights nothing and Back returns to the wrong screen.
 */
const PARENT: Partial<Record<Tab, Tab>> = {};
for (const [parent, children] of Object.entries(ATTACHED)) {
    for (const child of children) PARENT[child as Tab] = parent as Tab;
}

/** The tab a list is drawn under, or `undefined` when it stands on its own. */
export function parentOf(tab: Tab): Tab | undefined {
    return PARENT[tab];
}

/** The lists drawn under `tab`, in order. Empty for a tab that carries its own. */
export function attachedTo(tab: Tab): readonly Tab[] {
    return ATTACHED[tab] ?? [];
}
