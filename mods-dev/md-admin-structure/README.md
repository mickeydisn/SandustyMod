# MdAdmin Structure

`md-admin-structure` · v0.1.0 · **dev**

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

## Features

- **Filters** — **Mod** (All, or one specific owning mod) and **Menu** (All / Hidden / Shown).
- **Unlock** column — `api.player.buildings.unlockById(structureId)`; already-unlocked rows show a
  green **Unlocked** button (clicking re-runs the unlock, harmless).
- **Remove** column — `api.player.buildings.removeById(structureId)` to revoke the unlock.

## Sources

Rows are merged and de-duplicated by id, so a structure registered by a mod keeps its registry
definition (the one that carries `hideFromBuildMenu`):

1. `sandkit.mods.structures` — every mod-registered structure.
2. `api.structures.getAvailableTypes()` — all available types, when the API is present.
3. `sandkit.state.store.player.buildings` — the player's unlocked ids; the fallback list when
   `getAvailableTypes` is unavailable.

> The unlocked column is derived from the `state.store.player.buildings` snapshot, so a row turns
> green once that snapshot lists the id. `api.structures.isLockedByType(ref)` is an alternative
> authoritative check.

## Package dependencies

| Package           | Used for                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| `@sandmd/sandkit` | Global `sandkit` declaration (`api`, `mods`, `react`, `state`). Type-only. |

No `@sandmd/modkit` — the panel reads the live registries directly.

## Sandkit API used

| Area       | Calls                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Structures | `structures.getAvailableTypes`, `structures.getDefinitionByType`                                    |
| Player     | `player.buildings.unlockById`, `player.buildings.removeById`                                        |
| UI         | `ui.inject` (panel), `ui.toast`, `i18n.getName`                                                     |
| Registries | `sandkit.mods.structures` / `sandkit.state.sandkit.mods.structures`, `state.store.player.buildings` |
| Host       | `sandkit.react` (panel rendering)                                                                   |

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
