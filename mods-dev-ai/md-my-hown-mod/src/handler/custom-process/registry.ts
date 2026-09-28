/**
 * The index of the author's custom processes, and the scan that says where each one
 * is used.
 *
 * A registry rather than a lookup into `ModConfig` at every call site, because the
 * compiler resolves a process by id **many times** — once per reference, and again for
 * every nested step — and a linear scan per lookup would be paid on the game tick.
 * One index, built once at registration.
 *
 * @module
 */
import { type HandlerSlot, SLOTS_BY_CATEGORY } from "../core/handler-registry.ts";
import type { CustomProcessConfig } from "./types.ts";

/** Where a process reference was found. */
export interface ProcessUsage {
    /** The config key the definition lives under — `signals`, `processing`, … */
    category: string;
    /** The definition's own id. */
    id: string;
    /** The slot the definition sits in, which is the slot the process must match. */
    slot: HandlerSlot;
    /** The process this definition names. */
    processId: string;
}

/** The id suffix a migrated process gets, so a derived one is never confused with a named one. */
export const DERIVED_ID_SUFFIX = "#process";

/** The id a definition's legacy array is converted into. */
export function derivedProcessId(entryId: string): string {
    return `${entryId}${DERIVED_ID_SUFFIX}`;
}

/** One index of every process, by id. */
export class ProcessRegistry {
    readonly #byId = new Map<string, CustomProcessConfig>();

    constructor(processes: readonly CustomProcessConfig[] = []) {
        for (const p of processes) {
            if (p?.id) this.#byId.set(p.id, p);
        }
    }

    /** Look one up, or `undefined` for an id nothing claims. */
    get(id: string): CustomProcessConfig | undefined {
        return this.#byId.get(id);
    }

    /** Every process, in the order the author created them. */
    all(): CustomProcessConfig[] {
        return [...this.#byId.values()];
    }

    /** Every id, sorted — the order a picker should offer them in. */
    ids(): string[] {
        return [...this.#byId.keys()].sort();
    }

    /**
     * The processes a definition in this slot may use, sorted.
     *
     * Filtered on `scope` rather than shown and then refused, because a picker that
     * offers a process which cannot run is a picker that produces broken configs.
     */
    forSlot(slot: HandlerSlot): CustomProcessConfig[] {
        return this.all()
            .filter((p) => p.scope === slot)
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    /** Ids of every derived process, for the migration's cleanup pass. */
    derivedIds(): string[] {
        return this.all().filter((p) => p.derived).map((p) => p.id);
    }
}

/**
 * Which definitions reference which process.
 *
 * The reverse of the registry, and the reason a process screen can say `used ×3`. An
 * unused process is not an error — a half-built one is a normal state — but it should
 * be *visible*, and it cannot be without this.
 *
 * Reads `processId` only. A definition still holding a legacy `actions` array is
 * reported as naming nothing, because that is exactly what it does: the migration in
 * `../../config/store.ts` is what turns it into a reference, and until then there is
 * no process to count.
 */
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

/** How many definitions use each process id, for the `used ×N` chip. */
export function processUsageCounts(cfg: Record<string, unknown>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const u of scanProcessUsage(cfg)) {
        counts[u.processId] = (counts[u.processId] ?? 0) + 1;
    }
    return counts;
}

// ── The boot-time registry ────────────────────────────────────────────────────

/**
 * The registry the engine-shaped register functions use.
 *
 * ## Why a module-level holder rather than a parameter
 *
 * `mysandkit.ts` deliberately mirrors the engine's own signatures: `registerItem(def)`,
 * `registerUpgrade(def)` — one definition, no config. That is the right shape for a
 * layer whose job is "do what `api.items.register` does". Threading a `ProcessRegistry`
 * through both would mean changing signatures the engine dictated.
 *
 * So it is set **once**, at boot, from the config that is already loaded, and read
 * afterwards. The same reason `g()` is a module-level global in that file: the engine
 * itself is reached that way.
 *
 * A **holder object**, not a bare variable, so a test can install its own and put the
 * previous one back. A bare `let` would leak one test's processes into the next, and
 * the symptom — a process that resolves in one test and not another — is very hard to
 * trace back here.
 */
const holder: { current: ProcessRegistry | undefined } = { current: undefined };

/** Install the registry. Called once at boot, and by tests that need their own. */
export function setProcessRegistry(registry: ProcessRegistry | undefined): void {
    holder.current = registry;
}

/**
 * The installed registry, or an **empty** one.
 *
 * Never `undefined`, because every caller would then need its own guard, and the
 * failure it guards against — a definition that names a process before the boot
 * install — should be "the process does not resolve", not a crash in the register
 * path on a game tick.
 */
export function currentProcessRegistry(): ProcessRegistry {
    return holder.current ?? new ProcessRegistry();
}
