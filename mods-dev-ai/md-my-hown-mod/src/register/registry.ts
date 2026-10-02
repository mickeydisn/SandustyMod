import { COLLECTION_KEYS, type CollectionKey } from "../config/store.ts";


const WORKER_SCOPED: ReadonlySet<CollectionKey> = new Set<CollectionKey>([
    "elements",
    "terrains",
    "structures",
    "recipes",
]);


let windowOpen = true;

export function closeBootWindow(): void {
    windowOpen = false;
}


export function __resetBootWindowForTests(): void {
    for (const s of Object.values(registered)) s.clear();
    windowOpen = true;
}



export type Counted = [category: string, count: number];


export function registerEach<E extends { id?: string }>(
    entries: readonly E[] | undefined,
    cat: CollectionKey,
    register: (entry: E, id: string) => boolean | void,
): Counted {
    if (WORKER_SCOPED.has(cat) && !windowOpen) return [cat, 0];

    const seen = registered[cat];
    let n = 0;
    for (const entry of entries ?? []) {
        const id = entry?.id;
        if (!id || seen.has(id)) continue;
        if (register(entry, id) === false) continue;
        seen.add(id);
        n++;
    }
    return [cat, n];
}



export const registered: Record<CollectionKey, Set<string>> = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [key, new Set<string>()]),
) as Record<CollectionKey, Set<string>>;
