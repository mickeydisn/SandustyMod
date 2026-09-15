# MdAdmin Structure

A tiny dev panel (toggle: **Alt+O**) that lists structures.

It enumerates every **mod-registered structure** (`sandkit.mods.structures`)
plus the player's unlocked structures / whatever the engine reports as
available (`api.structures.getAvailableTypes`), then shows:

- the structure **name** and **id**
- its **category**
- the **owning mod** (the id prefix before `:`, e.g. `astro.seeds:thing` →
  `astro.seeds`; built-ins show `(built-in)`)
- whether it is **`hideFromBuildMenu`**
- whether it is already **unlocked**

## Filters

- **Mod** — All, or one specific owning mod.
- **Menu** — All / Hidden (`hideFromBuildMenu: true`) / Shown.

## Unlock / Remove columns

Each row has an **Unlock** button that calls
`api.player.buildings.unlockById(structureId)` — the same API a mod uses to
grant a building. Already-unlocked rows are shown with a green **Unlocked**
button (clicking it re-runs the unlock, harmless).

Each row also has a **Remove** button that calls
`api.player.buildings.removeById(structureId)` to revoke it from the player.

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo into build/ and the game folder
```