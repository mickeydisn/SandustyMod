import { COLLECTION_KEYS, type CollectionKey } from "../config/store.ts";
import type { ModConfig } from "../constants.ts";
import type { ProcessRegistry } from "../handler/custom-process/index.ts";

/** Categories the engine only accepts while the boot window is open. */
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

export const registered: Record<CollectionKey, Set<string>> = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [key, new Set<string>()]),
) as Record<CollectionKey, Set<string>>;

export function __resetBootWindowForTests(): void {
    for (const s of Object.values(registered)) s.clear();
    windowOpen = true;
}

/** What every register step is handed: the config plus the compiled process table. */
export interface RegisterContext {
    readonly config: ModConfig;
    readonly processes: ProcessRegistry;
}

/**
 * Register each entry of one category, once.
 *
 * Skips entries with no id and ids already recorded for this category. A step
 * that returns `false` rejects the entry: it is neither counted nor recorded,
 * so a later pass can retry it. Worker-scoped categories are skipped entirely
 * once {@link closeBootWindow} has run.
 *
 * @returns how many entries registered.
 */
export function registerEach<E extends { id?: string }>(
    entries: readonly E[] | undefined,
    cat: CollectionKey,
    register: (entry: E, id: string) => boolean | void,
): number {
    if (WORKER_SCOPED.has(cat) && !windowOpen) return 0;

    const seen = registered[cat];
    let n = 0;
    for (const entry of entries ?? []) {
        const id = entry?.id;
        if (!id || seen.has(id)) continue;
        if (register(entry, id) === false) continue;
        seen.add(id);
        n++;
    }
    return n;
}
