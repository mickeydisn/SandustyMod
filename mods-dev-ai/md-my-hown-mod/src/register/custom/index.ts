/**
 * The mod layer: config entries that exist for this mod and are never handed to
 * the engine as a registration.
 *
 * These are not second-class. A tab that lists them is a real tab the user
 * fills in, and the ids they mint are real — they are what other tabs put in a
 * dropdown. What they are *not* is a definition the engine holds. A name here is
 * a string this mod agrees on; nothing on the engine side of the boundary ever
 * sees it.
 *
 * The distinction matters because it decides what a *missing* registration
 * means. For a core category, "not registered" is a bug — the engine is missing
 * a thing. For a custom entry, there is nothing to be missing, and a loop that
 * tried to register one would be inventing an engine call that does not exist.
 *
 * So a custom entry is resolved, not registered. Resolution happens where it is
 * read: the moment a value would cross into the engine, the mod checks it
 * against what it declared here and either translates it or drops it.
 */

/** A mod-owned entry: an id, and whatever the panel chose to remember. */
export interface CustomEntry {
    id: string;
    name?: string;
    [key: string]: unknown;
}

/** The custom categories this mod owns, keyed by their config key. */
export const CUSTOM_CATEGORIES = [
    // Named energy channels. See `./energy-network.ts` for why these exist.
    "energyNetworks",
    // The "available from the start" node. It is a mod concept standing in for
    // two engine answers, and only its `tech` mode mints a real engine object.
    "unlockNodes",
] as const;

export type CustomCategory = typeof CUSTOM_CATEGORIES[number];

/** Ids declared for a custom category, from the stored config. */
export function customIds(
    category: CustomCategory,
    config: { [K in CustomCategory]?: CustomEntry[] },
): Set<string> {
    const out = new Set<string>();
    for (const e of config[category] ?? []) {
        if (e?.id) out.add(e.id);
    }
    return out;
}
