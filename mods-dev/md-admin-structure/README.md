# MdAdmin Structure

A tiny dev panel (toggle: **Alt+O**) that lists structures.

It enumerates every **mod-registered structure** (`sandkit.mods.structures`) plus the player's
unlocked structures / whatever the engine reports as available (`api.structures.getAvailableTypes`),
then shows:

- the structure **name** and **id**
- its **category**
- the **owning mod** (the id prefix before `:`, e.g. `astro.seeds:thing` → `astro.seeds`; built-ins
  show `(built-in)`)
- whether it is **`hideFromBuildMenu`**
- whether it is already **unlocked**

## Filters

- **Mod** — All, or one specific owning mod.
- **Menu** — All / Hidden (`hideFromBuildMenu: true`) / Shown.

## Unlock / Remove columns

Each row has an **Unlock** button that calls `api.player.buildings.unlockById(structureId)` — the
same API a mod uses to grant a building. Already-unlocked rows are shown with a green **Unlocked**
button (clicking it re-runs the unlock, harmless).

## Sources

Rows are merged from three places and de-duplicated by id, so a structure registered by a mod keeps
its registry definition (which is the one that carries `hideFromBuildMenu`):

1. `sandkit.mods.structures` — every mod-registered structure.
2. `api.structures.getAvailableTypes()` — all available types, when the API is present.
3. `sandkit.state.store.player.buildings` — the player's unlocked ids; used as the fallback list
   when `getAvailableTypes` is unavailable.

> The unlocked column is derived from the `state.store.player.buildings` snapshot, so a row turns
> green once that snapshot lists the id. `api.structures.isLockedByType(ref)` is an alternative
> authoritative check.

Each row also has a **Remove** button that calls `api.player.buildings.removeById(structureId)` to
revoke it from the player.

## Layout

| File               | Responsibility                                              |
| ------------------ | ----------------------------------------------------------- |
| `src/main.ts`      | Entry point: the Alt+O toggle and boot wiring.              |
| `src/constants.ts` | Mod id, version, panel id, toggle, glyphs, log prefix.      |
| `src/types.ts`     | Local typing for the admin API surface + React subset.      |
| `src/api.ts`       | Typed `sandkit` handle, React handle, `safe()` / `toast()`. |
| `src/data.ts`      | The three structure sources and row building.               |
| `src/styles.ts`    | `COLORS` + panel styles.                                    |
| `src/state.ts`     | Panel open flag + the external repaint handle.              |
| `src/panel.ts`     | The injected React panel.                                   |

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```
