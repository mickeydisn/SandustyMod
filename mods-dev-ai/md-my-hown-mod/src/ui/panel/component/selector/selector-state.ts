/**
 * Picking a content object: one id, or several, from everything that exists.
 *
 * The one answer for every field whose options name a content object, whether the
 * field takes one or many. Over a native `<select>` it adds a swatch, a mod filter
 * defaulting to yours, and substring search.
 *
 * **It does not accept a typed id** — a reference field must never invent a value,
 * and an entry naming something no longer present stays visible as an orphan chip.
 *
 * **It does not change the stored shape**: single stays a string, multiple stays a
 * comma-separated list, so existing config needs no migration.
 *
 * The pure logic, deliberately free of React; `selector.tsx` renders on top.
 */

import type { Opt } from "../../../../catalog.ts";
import { OWN_ID_PREFIXES } from "../../../../constants.ts";

/** Which owner bucket a picker is showing. Mirrors `panel/list.ts`'s `OwnerKey`. */
export type SelectorOwner = "own" | "game" | "all";

/** What the selector renders for one option. */
export interface SelectorItem {
    value: string;
    label: string;
    color?: string;
    /** True when the id is namespaced with this mod's prefix. */
    own: boolean;
    /** The other mod that owns it, when it is not ours and not the game's. */
    modId?: string;
    /**
     * The object is kept out of normal use: an element marked `hidden`, a
     * structure marked `hideFromBuildMenu`.
     *
     * Defaults to **hidden** here rather than to shown. A picker that listed
     * these by default would put the game's internal element types — resolved
     * pointers, intermediate states — next to things a recipe can sensibly name,
     * which is a list nobody can read. Opting *in* is the deliberate act.
     */
    hidden?: boolean;
}

/**
 * A content object id, read the ecosystem way: `<modId>.<name>`.
 *
 * Shared with `panel/list.ts` on purpose — the list screen's "This mod" chip and
 * this picker's "This mod" filter must not disagree about which objects are
 * yours, and two parsers of the same convention is exactly how they would.
 * `OWN_ID_PREFIXES` holds this mod's package name and the shorter prefix its own
 * config uses, so both spellings count.
 *
 * An id with no dot is the game's, not a mod called `Sand` — attribution is read,
 * never guessed.
 */
export function classifyId(id: string): { own: boolean; modId?: string } {
    const dot = id.indexOf(".");
    if (dot <= 0) return { own: false };
    const modId = id.slice(0, dot);
    return { own: OWN_ID_PREFIXES.includes(modId), modId };
}

/**
 * Catalogue options as selector items.
 *
 * `Opt.source` is a tiebreaker, not the primary answer. A mod entry is `own` by
 * construction — it came out of *this* config, whatever it is named — so an entry
 * stored under an unnamespaced id is still ours, which is why the id alone is not
 * the last word here.
 */
export function toSelectorItems(opts: readonly Opt[]): SelectorItem[] {
    return opts.map((o) => {
        const fromId = classifyId(o.value);
        const own = fromId.own || o.source === "mod";
        return {
            value: o.value,
            label: o.label,
            color: o.color,
            own,
            modId: own ? undefined : fromId.modId,
            hidden: o.hidden === true,
        };
    });
}

/**
 * Drop the hidden rows unless the user asked to see them.
 *
 * Separate from `filterByOwner` on purpose: this is not about *whose* an object
 * is but whether it is one you are meant to use. The two are independent — the
 * mod's own hidden element and the game's hidden element are both filtered by
 * the same rule, and both come back with the same checkbox.
 */
export function filterHidden(
    items: readonly SelectorItem[],
    showHidden: boolean,
): SelectorItem[] {
    if (showHidden) return [...items];
    return items.filter((i) => !i.hidden);
}

/** How many items are hidden, for the checkbox's label. */
export function countHidden(items: readonly SelectorItem[]): number {
    let n = 0;
    for (const i of items) if (i.hidden) n++;
    return n;
}

/** Items an owner filter keeps. `"all"` is the only filter that keeps everything. */
export function filterByOwner(
    items: readonly SelectorItem[],
    owner: SelectorOwner,
): SelectorItem[] {
    if (owner === "all") return [...items];
    if (owner === "own") return items.filter((i) => i.own);
    return items.filter((i) => !i.own && !i.modId);
}

/**
 * Items matching a search string, over id and label.
 *
 * Substring, case-insensitive — the same forgiving middle `filterRows` uses. A
 * prefix match hides `mdmy.ores` from a search for `ores`; a regex turns a stray
 * `(` into a silently empty list.
 */
export function filterByText(
    items: readonly SelectorItem[],
    text: string,
): SelectorItem[] {
    const q = text.trim().toLowerCase();
    if (!q) return [...items];
    return items.filter((i) => `${i.value} ${i.label}`.toLowerCase().includes(q));
}

/** How many items each owner bucket holds, for the filter chips. */
export function countByOwner(items: readonly SelectorItem[]): Record<SelectorOwner, number> {
    const out: Record<SelectorOwner, number> = { own: 0, game: 0, all: 0 };
    for (const i of items) {
        out.all++;
        if (i.own) out.own++;
        else if (!i.modId) out.game++;
    }
    return out;
}

/** Other mods present in the items, alphabetically. */
export function otherMods(items: readonly SelectorItem[]): string[] {
    const seen = new Set<string>();
    for (const i of items) if (!i.own && i.modId) seen.add(i.modId);
    return [...seen].sort();
}

/**
 * Apply the item as a choice: replace for single, toggle for multiple.
 *
 * Returns a list even for a single field, because the caller's form encoding
 * decides what to do with it. Order follows the options, not the click order, so
 * picking A then B gives the same form as B then A — a form that reorders on
 * every click makes an entry look edited when it is not.
 */
export function applyChoice(
    current: readonly string[],
    value: string,
    multiple: boolean,
    order: readonly string[],
): string[] {
    if (!multiple) return [value];
    const set = new Set(current);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return order.filter((v) => set.has(v));
}

/**
 * The choices whose id is not in `items` — a reference to something that no
 * longer exists.
 *
 * Returned rather than dropped so the caller can keep showing them. An entry
 * pointing at an element another mod has since removed must stay editable:
 * hiding the value would make the field look empty while the entry still holds
 * it, and the user would have no way to see or clear what was there.
 */
export function orphans(selected: readonly string[], items: readonly SelectorItem[]): string[] {
    const known = new Set(items.map((i) => i.value));
    return selected.filter((v) => v && v !== "__none__" && !known.has(v));
}
