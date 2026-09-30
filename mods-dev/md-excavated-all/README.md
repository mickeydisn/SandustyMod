# Excavated All

`excavated-all` · v0.1.0 · **dev**

A total-clear excavation tool for Sandustry. Where the vanilla dig tools respect hit points,
material rules and build/tool authorization zones, **Excavated All** doesn't: it calls the removal
APIs directly, so it can strip terrain (including bedrock-class "fixed" terrain), elements and
structures from any cell, in any zone.

## Features

1. **"Total Excavator" tool** — a registered item, added to the player's inventory automatically.
2. **Hotbar panel** — visible whenever the tool is selected; radius stepper + four filter toggles.
3. **Four firing paths** — `item:used` event, `hooks.intercept("item:use")`, pointerdown + hold
   while the tool is active, and the `X` key (hold to keep clearing). The brush is a circular region
   centred on the cursor cell.

### Filters

| Filter      | Effect                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| `Terrain`   | Zeroes hit points and force-removes ordinary diggable terrain (stone, dirt, ice, moss, …).  |
| `Structure` | Removes the **entire building** a hit cell belongs to, not just the cells inside the brush. |
| `Element`   | Removes simulated matter (sand, water, gas, powders, …) occupying the cell.                 |
| `Fixed`     | Also force-clears normally **indestructible** terrain — bedrock/blackrock/border-class ids. |

All four are **on by default**. Cells inside a no-build / no-tool **authorization zone are always
skipped**, the same as the game's own tools.

### Tunables (`src/ids.ts`)

| Constant                            | Default | Meaning                             |
| ----------------------------------- | ------: | ----------------------------------- |
| `RADIUS_MIN` / `MAX` / `DEFAULT`    |  1/48/6 | Brush radius bounds (cells)         |
| `FIRE_COOLDOWN_MS`                  |      90 | Minimum gap between fires           |
| `HOLD_INTERVAL_MS`                  |     110 | Hold-to-repeat cadence              |
| `EXCAVATE_ENERGY`                   |       0 | Energy cost (0 disables the check)  |
| `STRUCTURE_FOOTPRINT_SEARCH_RADIUS` |      10 | Scan radius to find a full building |

## Item, overlay & bindings

| Id                        | Kind    | Notes                                             |
| ------------------------- | ------- | ------------------------------------------------- |
| `excavated-all.excavator` | item    | Brush tool (`items.register`, inventory-granted). |
| `excavated-all.icon`      | sprite  | `assets/icon.png` via `sprites.loadFromMod`.      |
| `excavated-all.panel`     | overlay | Hotbar overlay (`ui.overlays`).                   |
| `excavated-all.fire`      | binding | Default key `X` (`input.registerBinding`).        |

`api.storage` keys: `radius`, `filters`.

## Package dependencies

| Package           | Used for                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `@sandmd/sandkit` | Global `sandkit` declaration (`api`, `enums`, `react`, `state`). Type-only. |

This mod keeps its own `api.ts` / `types.ts` / `state.ts` instead of `@sandmd/modkit`, because it
needs a bespoke typed surface for the terrain/structure/authorization calls.

## Sandkit API used

| Area              | Calls                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration      | `items.register`, `sprites.loadFromMod`, `ui.overlays`, `ui.toast`, `i18n` keys                                                                                                           |
| Input             | `items.getActive`, `items.isActiveById`, `input.getMousePositionAtCell`, `input.getMouseCellPosition`, `input.registerBinding`, `hooks.intercept("item:use")`, `energy.consume`           |
| Terrain           | `terrains.getTypeAtCell`, `terrains.getDefinitionByType`, `terrains.getIdByType`, `terrains.damageAtCell`, `terrains.setHitPointsAtCell`, `terrains.setHpAtCell`, `terrains.removeAtCell` |
| Elements          | `elements.getTypeAtCell`, `elements.removeAtCell`                                                                                                                                         |
| Structures        | `structures.getAtCell`, `structures.removeAtCell`, `structures.removeBetweenCells`                                                                                                        |
| Grid              | `grid.mutate`, `grid.redrawAroundCell`, `grid.reportActivityAtCell`                                                                                                                       |
| Authorization     | `authorization.canUseToolAtCell`                                                                                                                                                          |
| Overlay rendering | `rendering.getGridMetrics`, `rendering.getDrawPositionAtWorld`, `rendering.withOverlayContext`, `events.on("frame:render")`                                                               |
| Lifecycle         | `events.on("game:ready")`, `storage.get`, `storage.set`                                                                                                                                   |

## Design notes

**Why it can remove "unremovable" terrain.** `terrains.removeAtCell` isn't gated by the same
hit-point/damage system `terrains.damageAtCell` goes through — a direct `removeAtCell` (after
zeroing hit points) clears terrain normal tools can't scratch, bedrock included.

**Why a hit on any part of a structure clears the whole thing.** `structures.getAtCell` returns the
instance for any cell in a multi-cell footprint; removing only the touched cell leaves a broken
remnant. The engine scans a bounded area for cells reporting the same instance and removes the whole
bounding box in one `removeBetweenCells` call.

**Structure-embedded terrain** (conveyors, shakers, sliding blocks — `CellType` 16–22) is tied to
the **Structure** filter, not **Terrain**: clearing it with Structure off would strip half a machine
and leave the rest behind. `STRUCTURE_TERRAIN_HINTS` covers engines that report names instead of
numeric ids.

**Terrain under a structure.** With `Structure` off, `Terrain` does nothing on cells a building
occupies while `Element` still clears there — that's the engine, not a bug: placement is gated on
cell occupancy, so a structure only ever sits on already-cleared ground. The panel/toast surface
this (`"…(N more under structures — enable Structure to clear those)"`).

**Authorization is query-only.** `api.authorization` exposes `canBuildAtCell`, `canUseToolAtCell`
and `getZoneIdAtCell` — there is no setter, so an earlier "No-auth" toggle only let _this tool_ act
inside a zone for one click. It was removed; the excavator always respects zones.

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
