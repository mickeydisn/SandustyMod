
import { type HandlerSlot, SLOTS_BY_CATEGORY } from "../core/handler-registry.ts";
import type { CustomProcessConfig } from "./types.ts";


export interface ProcessUsage {
    
    category: string;
    
    id: string;
    
    slot: HandlerSlot;
    
    processId: string;
}


export const DERIVED_ID_SUFFIX = "#process";


export function derivedProcessId(entryId: string): string {
    return `${entryId}${DERIVED_ID_SUFFIX}`;
}


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

    
    derivedIds(): string[] {
        return this.all().filter((p) => p.derived).map((p) => p.id);
    }
}


export function scanProcessUsage(cfg: Record<string, unknown>): ProcessUsage[] {
    const out: ProcessUsage[] = [];
    for (const [category, entries] of Object.entries(cfg)) {
        const slot = SLOTS_BY_CATEGORY[category];
        if (!slot || !Array.isArray(entries)) continue;
        for (const entry of entries as Record<string, unknown>[]) {
            const id = entry?.processId;
            if (typeof id !== "string" || !id) continue;
            out.push({ category, id: String(entry?.id ?? "?"), slot, processId: id });
        }
    }
    return out;
}


export function processUsageCounts(cfg: Record<string, unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const u of scanProcessUsage(cfg)) {
        counts[u.processId] = (counts[u.processId] ?? 0) + 1;
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
