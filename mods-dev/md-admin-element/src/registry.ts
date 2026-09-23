/**
 * mdadmin — element registry access.
 *
 * Enumerates the live element registry, deletes elements from it and keeps the
 * persistent blacklist of removals in mod storage. Removals survive reloads
 * because `reapplyRemovals()` re-scrubs on every load.
 */
import { api, root, safe } from "./api.ts";
import { BUILT_IN, MOD_ID, REMOVED_STORE_KEY } from "./constants.ts";
import type { ModElementDef, RegisteredRow, SandkitMods } from "./types.ts";

/**
 * The live mod registries. On the real runtime the container can live on
 * `sandkit.mods` directly, or nested under `sandkit.state.sandkit.mods` —
 * accept both.
 */
function modsBox(): SandkitMods | undefined {
    return root.mods ?? root.state?.sandkit?.mods;
}

/** Every element a mod registered in this session. */
export function modRegistry(): Record<string, ModElementDef> | undefined {
    return modsBox()?.elements;
}

/** The matching matter records, deleted alongside their element. */
export function mattersRegistry(): Record<string, unknown> | undefined {
    return modsBox()?.matters;
}

/** Best effort: the element-id prefix before ":" is the owning mod. */
export function ownerMod(elementId: string): string {
    const sep = elementId.indexOf(":");
    return sep > 0 ? elementId.slice(0, sep) : BUILT_IN;
}

// --- persistent blacklist -------------------------------------------------

/** Remembered element ids, read from mod storage. */
export function loadRemoved(): string[] {
    const raw = safe(() => api.storage.get(MOD_ID, REMOVED_STORE_KEY));
    if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
    return [];
}

/** Persist the remembered element ids. */
export function saveRemoved(list: string[]): void {
    safe(() => api.storage.set(MOD_ID, REMOVED_STORE_KEY, list));
}

// --- data -----------------------------------------------------------------

/** Every registered element, sorted by type, ready for the panel. */
export function registeredRows(): RegisteredRow[] {
    const types = safe(() => api.elements.getRegisteredTypes(), []) ?? [];
    const registry = modRegistry();

    return types
        .map((t) => {
            const def = safe(() => api.elements.getDefinitionByType(t)) ?? {};
            const id = def.id ?? String(t);
            const removable = Boolean(registry && id in registry);
            const name = safe(() => api.elements.getNameByType?.(t)) ?? def.nameKey ?? id;
            const color = typeof def.metaColor === "number"
                ? `#${def.metaColor.toString(16).padStart(6, "0")}`
                : "#8a8a8a";
            return { type: t, id, name, color, mod: ownerMod(id), removable };
        })
        .sort((a, b) => a.type - b.type);
}

// --- removal --------------------------------------------------------------

/** Delete one element from the live registry and remember it as removed. */
export function removeElement(id: string): boolean {
    const registry = modRegistry();
    const matters = mattersRegistry();
    if (!registry || !(id in registry)) return false;

    delete registry[id];
    if (matters && id in matters) delete matters[id];

    const removed = new Set(loadRemoved());
    removed.add(id);
    saveRemoved([...removed]);
    return true;
}

/**
 * Re-apply every remembered removal to the current registry. Call after mods
 * have (re)registered so ghost elements from removed mods are scrubbed too.
 */
export function reapplyRemovals(): void {
    const registry = modRegistry();
    const matters = mattersRegistry();
    const removed = loadRemoved();
    if (!registry || removed.length === 0) return;

    for (const id of removed) {
        if (id in registry) delete registry[id];
        if (matters && id in matters) delete matters[id];
    }
}
