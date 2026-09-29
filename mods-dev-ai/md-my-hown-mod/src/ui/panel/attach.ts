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
    items: ["excavation", "projectiles", "excavationOption", "projectileOption"],
    techs: ["unlockNodes"],
    upgrades: ["categories", "upgradeAction"],
};

/**
 * The attached lists whose contents are written in code, and so are drawn **here**.
 *
 * Every other attached list is a list of *entries*: the author adds them, and the
 * list is a frame around a config array. These two hold presets instead —
 * `PROJECTILE_OPTIONS` and `EXCAVATION_OPTIONS`, compiled once and reused — so
 * there is no entry to add. Given the generic attached frame they came out as an
 * empty box with a `+ New` button on it: a button that offered to create a
 * seventh projectile option, and behind it, a whole screen holding the list the
 * author actually came for.
 *
 * So these are drawn as their own thing rather than as an empty list — the
 * presets themselves, inline, in a disclosure, under the entry list they qualify.
 * The list is the content; there is nothing to navigate to.
 */
export const INLINE_CATALOGUES: readonly Tab[] = ["excavationOption", "projectileOption"];

/**
 * Whether this tab is drawn by its own renderer rather than the attached frame.
 *
 * The test is deliberately a table and not a rule. "Has no config array" would
 * also catch any future read-only list, and a read-only list that should be
 * navigable would be silently inlined instead — the failure is a section that
 * cannot be reached on its own, which is quiet. Naming the two is honest about
 * the fact that this is a per-screen decision.
 */
export function isInlineCatalogue(tab: Tab): boolean {
    return INLINE_CATALOGUES.includes(tab);
}

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
