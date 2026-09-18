/**
 * md-admin-structure — structure sources.
 *
 * Rows come from three places, merged and de-duplicated by id:
 *  - `sandkit.mods.structures`            — every mod-registered structure
 *  - `sandkit.state.store.player.buildings` — the player's unlocked ids
 *  - `api.structures.getAvailableTypes()`  — all available types (when present)
 */
import { api, root, safe } from "./api.ts";
import { BUILT_IN } from "./constants.ts";
import type { StructureDefinition, StructureRow } from "./types.ts";

/** Every structure registered by a mod this session. */
function modStructuresMap(): Record<string, StructureDefinition> | undefined {
    return root.mods?.structures ?? root.state?.sandkit?.mods?.structures;
}

/** The player's unlocked structure ids. */
function unlockedBuildingIds(): string[] {
    const b = root.state?.store?.player?.buildings;
    return Array.isArray(b) ? b.filter((v): v is string => typeof v === "string") : [];
}

/** Best effort: the structure-id prefix before ":" is the owning mod. */
export function ownerMod(id: string): string {
    const sep = id.indexOf(":");
    return sep > 0 ? id.slice(0, sep) : BUILT_IN;
}

/** Every known structure, sorted by id, ready for the panel. */
export function structureRows(): StructureRow[] {
    const unlocked = new Set(unlockedBuildingIds());
    const rows = new Map<string, StructureRow>();

    const add = (id: string, def: StructureDefinition | null | undefined): void => {
        const d = def ?? {};
        const sid = typeof d.id === "string" ? d.id : id;
        if (!sid || rows.has(sid)) return;
        const name = d.name ??
            safe(() => api.i18n.getName?.(d) ?? null) ??
            d.nameKey ??
            sid;
        rows.set(sid, {
            id: sid,
            name,
            mod: ownerMod(sid),
            category: d.categoryKey ?? "",
            hidden: d.hideFromBuildMenu === true,
            unlocked: unlocked.has(sid),
        });
    };

    // 1) All mod-registered structures (authoritative, has hideFromBuildMenu).
    const mods = modStructuresMap();
    if (mods) { for (const id of Object.keys(mods)) add(id, mods[id]); }

    // 2) Everything else the engine reports as available / unlocked.
    const available = safe(() => api.structures.getAvailableTypes?.());
    const refs: Array<number | string> = available ? [...available] : unlockedBuildingIds();
    for (const ref of refs) {
        const def = safe(() => api.structures.getDefinitionByType?.(ref));
        add(typeof def?.id === "string" ? def.id : String(ref), def);
    }

    return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}
