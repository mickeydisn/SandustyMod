import type { HandlerSlot } from "../../engine/registry/types.ts";
import { SLOT_CATEGORIES } from "../../engine/registry/categories.ts";
import type { CustomProcessConfig } from "./types.ts";

/**
 * The custom processes a config declares, by id.
 *
 * `get` returns the config, `forSlot` the ones built for one call site, and
 * `ids` every name, sorted. A config declaring two processes with the same id
 * keeps the last one, which is what the loader produced before this was a map.
 */
export class ProcessRegistry {
    readonly #byId = new Map<string, CustomProcessConfig>();

    constructor(processes: readonly CustomProcessConfig[] = []) {
        for (const p of processes) {
            if (p?.id) this.#byId.set(p.id, p);
        }
    }

    get(id: string): CustomProcessConfig | undefined {
        return this.#byId.get(id);
    }

    all(): CustomProcessConfig[] {
        return [...this.#byId.values()];
    }

    ids(): string[] {
        return [...this.#byId.keys()].sort();
    }

    forSlot(slot: HandlerSlot): CustomProcessConfig[] {
        return this.all()
            .filter((p) => p.scope === slot)
            .sort((a, b) => a.id.localeCompare(b.id));
    }
}

/**
 * How many entries reference each custom process, by process id.
 *
 * This used to be two exports: `scanProcessUsage` returned a `ProcessUsage`
 * row per referencing entry, and `processUsageCounts` counted those rows. Only
 * the count was ever read, so the row shape — category, entry id, slot — was
 * built on every call and then thrown away. One pass, no intermediate array.
 */
export function processUsageCounts(cfg: Record<string, unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [category, entries] of Object.entries(cfg)) {
        // only categories the engine reads can reference a process
        if (!SLOT_CATEGORIES.has(category) || !Array.isArray(entries)) continue;
        for (const entry of entries as Record<string, unknown>[]) {
            const id = entry?.processId;
            if (typeof id !== "string" || !id) continue;
            counts[id] = (counts[id] ?? 0) + 1;
        }
    }
    return counts;
}

const holder: { current: ProcessRegistry | undefined } = { current: undefined };

export function setProcessRegistry(registry: ProcessRegistry | undefined): void {
    holder.current = registry;
}

export function currentProcessRegistry(): ProcessRegistry {
    return holder.current ?? new ProcessRegistry();
}
