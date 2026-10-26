# sandkit.api namespaces — verified for 0.6.0

Source of truth for the **public** surface:  
https://sandustry.dev/api (labelled **v0.6.0**, 65 namespaces).

This page exists so our docs do **not** hand-wave “the usual namespaces”.  
Everything listed below is present on the official 0.6.0 reference.  
Internal-only engine paths (`prefabDecor`, raw `RegisterMod*`, etc.) are **not** sandkit namespaces and are omitted.

---

## Full list (alphabetical)

| Namespace | Methods (approx.) | Worker? | Notes for 0.6 |
|-----------|-------------------|---------|----------------|
| `action` | 4 | | Active tool action + custom data |
| `assets` | 4 | | **New emphasis in 0.6** — providers, `getUrl`, `getSelectedProvider` / `setSelectedProvider` |
| `aura` | 3 | | Aura / Swarm Console state |
| `authorization` | 6 | | Build/grab/tool permissions at cells |
| `blueprints` | 2 | | Prefabulator serialize / localize |
| `building` | 9 | | Placement snap, blockage, select/cancel |
| `camera` | 3 | | Focus / release camera |
| `collector` | 5 | ✓ | Pickup values & collectability |
| `constants` | 0 | ✓ | Frozen engine constants (physics modes) |
| `cooldown` | 3 | | Per-mod named cooldowns |
| `discoveries` | 2 | | Mark elements/terrains discovered |
| `effects` | 8 | ✓ | World-space VFX (lasers, particles, …) |
| `elements` | 47 | ✓ | Register + cell mutate/query (`…WhenIdle` on main) |
| `energy` | 8 | | Custom energy types & networks |
| `entities` | 23 | | Discrete world entities |
| `events` | 2 | ✓ | `on` / `emit` — includes `game:ready`, `game:started`, … |
| `excavation` | 1 | | Named excavation profiles |
| `factory` | 16 | | Factory level / production rates |
| `fire` | 5 | ✓ | Burn checks + ignite when idle |
| `game` | 2 | | Session control (`start`, …) |
| `gameConfig` | 2 | | Read-only global config |
| `grid` | 16 | | Iterate cells in region |
| `hooks` | 2 | ✓ | `intercept` / `modify` named engine hooks |
| `i18n` | 20 | | Register locales, `t()` |
| `input` | 13 | | Custom key bindings |
| `items` | 13 | | Register / spawn items |
| `lights` | 8 | | Transient + persistent lights |
| `maps` | 15 | ✓ | List / start maps |
| `mods` | 1 | | **`getProviders(kind)`** — pairs with `assets` |
| `patterns` | 2 | ✓ | Excavation shapes |
| `pickups` | 7 | | World pickups |
| `pipes` | 12 | | Liquid/gas pipes & vents |
| `player` | 24 | ✓ | Position, inventory, buildings — see aliases below |
| `processing` | 3 | | Convenience recipes (Grower / Shaker / Kinetic Press) |
| `progression` | 6 | | Tutorial / progression steps |
| `projectiles` | 10 | | Custom projectiles |
| `random` | 2 | ✓ | Seeded RNG |
| `raycast` | 3 | | World-space ray hits |
| `reactions` | 1 | | Contact element reactions |
| `rendering` | 25 | | Overlays, shaders, world shader effects, metrics |
| `resources` | 4 | | Fluxite / energy resource helpers |
| `scene` | 1 | | Active scene |
| `schedule` | 1 | | Next-tick deferral |
| `settings` | 3 | | **configSchema** values for *this* mod |
| `shared` | 9 | ✓ | SharedArrayBuffer buffers (main creates, worker reads) |
| `signals` | 4 | | Signal target handlers |
| `sound` | 8 | | Play / layer / stop with world position |
| `sprites` | 7 | | Load (incl. from mod folder), player mod sprites |
| `storage` | 7 | | Per-mod persistent KV + device-local store |
| `stratacores` | 3 | | Unlockable late-game collectibles |
| `strataforms` | 3 | | Spreading terrain transforms |
| `structureBehaviors` | 4 | | Custom conveyor / launcher behaviours |
| `structures` | 52 | ✓ | Buildings, recipes, processors, place/query |
| `tech` | 15 | | Tech tree — see aliases below |
| `terrains` | 28 | ✓ | Terrain register + cell mutate/query |
| `thermal` | 5 | | Element heat |
| `time` | 3 | | Game time / tick |
| `tools` | 4 | | Grabber tool state |
| `triggers` | 1 | | Interval callbacks |
| `ui` | 35 | ✓* | Toast / dialogs / overlays / React inject (*toast only in worker) |
| `upgrades` | 6 | | Upgrade categories & trees |
| `utils` | 5 | ✓ | Geometry helpers |
| `weapons` | 1 | | Fire weapons from world coords |
| `workers` | 1 | | Enable post-update worker hook |
| `world` | 18 | ✓ | Grid, excavate, fog, runWhenIdle, pickups |

\* Worker availability is taken from the official reference markers.

---

## Known aliases / preferred names (0.6)

Prefer the **AtWorld / ById** style names. Older names still exist as aliases in many cases but are the “legacy” spelling on the wiki.

| Prefer (0.6 style) | Older / alias | Notes |
|--------------------|---------------|--------|
| `player.getPositionAtWorld()` | `player.getWorldPosition()` | Same underlying `FH.player.getPosition` |
| `player.setPositionAtWorld(x, y)` | `player.setWorldPosition(x, y)` | Same underlying setter |
| `player.isPositionClearAtWorld(x, y)` | `player.isWorldPositionClear(x, y)` | Same underlying check |
| `player.inventory.hasById` / `addById` / `removeById` | older inventory helpers | Prefer `*ById` |
| `player.buildings.unlockById` / `unlockByType` | — | Explicit id vs type |
| `tech.registerDefinition(id, def)` | `tech.addDefinition(id, def)` | **Both alias the same internal** `FH.tech.addDefinition` — either is fine |
| Main-thread mutators `…WhenIdle` | Worker `…AtCell` | Do **not** call the wrong variant for the thread |

Engine-internal (Pixi) note only: `cacheAsBitmap` is deprecated in favour of `cacheAsTexture` inside the renderer — this is **not** a sandkit API; ignore unless you touch raw Pixi objects.

---

## Not sandkit.api (do not list as namespaces)

These appear in the 0.6 **bundle** but are loader / simulation internals, not methods on `sandkit.api`:

- `RegisterModMatters` / `RegisterModElements` / `RegisterModTerrains` / `RegisterModStructures` / `RegisterModRecipes` / `RegisterModSharedBuffer` — messages the loader posts to workers after your `register()` calls.
- `decorOverrides` / `prefabDecor` — internal prefab decoration path.
- Manifest-only fields: `textureOverrides`, `provides`, `shaderOverrides`, `worldgenEntry`, `configOverrides`, `configSchema`, `map`.

---

## Practical rule for docs & mods

1. Treat https://sandustry.dev/api as authoritative for method lists and signatures.  
2. Prefer `*AtWorld` / `*ById` / `registerDefinition` spellings in new code.  
3. On the main thread, use `…WhenIdle` mutators; in a `workerEntry`, use the direct `…AtCell` variants.  
4. Do not invent namespaces from bundle identifiers — if it is not on the official list above, it is not a public sandkit namespace.