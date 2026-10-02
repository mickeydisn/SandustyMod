/**
 * Build-menu membership for a mod structure type.
 *
 * The management window builds its list straight from
 * `store.player.buildings` (bundel 151647):
 *
 *   store.player.buildings
 *       .filter(t => !(V.VI[t] || sandkit.mods.structures[t])?.hideFromBuildMenu)
 *
 * `alwaysUnlocked` is **not** part of that expression. It is read in exactly
 * one place (bundel 3268), while walking `Ue` — the `const` object literal
 * holding the vanilla structures. A mod id never enters `Ue`, so the flag is
 * inert for us no matter how it is set. Membership in `player.buildings` is
 * the only thing that lists a mod structure.
 *
 * The real members of `api.player.buildings` are `unlockById`, `unlockByType`
 * and `removeById`. There is no `add`, so `add?.(id)` is an optional call on
 * `undefined` — it returns quietly and unlocks nothing. That is exactly how
 * this mod registered its structures correctly and still showed an empty
 * build menu.
 */
import "@sandmd/sandkit";

interface BuildingsApi {
    unlockById?: (id: string) => unknown;
    unlockByType?: (id: string) => unknown;
    add?: (id: string) => void;
}

/**
 * Make `structureId` appear in the build menu.
 *
 * `unlockById` is the real call. `add` is kept only as a fallback for builds
 * that expose it instead, mirroring the pattern used by `md-channel-pads` and
 * `md-big-brother`.
 *
 * Returns true when the id is in `player.buildings` afterwards.
 */
export function unlockInBuildMenu(structureId: string): boolean {
    const buildings = (sandkit.api as unknown as {
        player?: { buildings?: BuildingsApi };
    } | undefined)?.player?.buildings;

    if (!buildings) return false;

    try {
        // Real API. `unlockById` reports whether it actually added the id.
        buildings.unlockById?.(structureId);
    } catch {
        try {
            buildings.add?.(structureId);
        } catch {
            return false;
        }
    }

    // Verify rather than trust: a build can expose neither call, and the whole
    // point of this helper is that a silent no-op is the failure mode.
    const list = sandkit.state?.store?.player?.buildings;
    return Array.isArray(list) && list.includes(structureId);
}