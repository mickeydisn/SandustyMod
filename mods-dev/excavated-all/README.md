# Excavated All

A total-clear excavation tool for Sandustry. Where the vanilla dig tools respect hit points,
material rules, and build/tool authorization zones, **Excavated All** doesn't: it calls the
removal APIs directly, so it can strip terrain (including bedrock-class "fixed" terrain),
elements, and structures from any cell, in any zone.

## What it does

On load it:

1. **Registers "Total Excavator"** — a tool item, added to your inventory automatically.
2. **Injects a hotbar panel** (visible whenever the tool is selected) with a radius stepper and
   four filter toggles.
3. **Fires on click, click-and-hold, or the `X` key (hold to keep clearing)** — a circular brush
   centred on the cursor cell.

For every cell inside the brush radius, depending on which filters are on, it will:

| Filter       | Effect                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------- |
| `Terrain`    | Zeroes hit points and force-removes ordinary diggable terrain (stone, dirt, ice, moss, …).   |
| `Structure`  | Removes the **entire building** a hit cell belongs to, not just the cells inside the brush.  |
| `Element`    | Removes simulated matter (sand, water, gas, powders, …) occupying the cell.                  |
| `Fixed`      | Also force-clears normally **indestructible** terrain — bedrock/blackrock/border-class ids.  |

All four are **on by default** — the tool removes everything, everywhere, including the
"impossible" and "fixed" cells. Turn a filter off in the panel if you want the brush to leave
that category (or that protection) alone.

Cells inside a no-build / no-tool **authorization zone are always skipped**, the same as any
other tool would skip them — see "About authorization zones" below for why there's no toggle
to force those.

## Why it can remove "unremovable" terrain

`api.terrains.removeAtCell` isn't gated by the same hit-point/damage system that
`api.terrains.damageAtCell` goes through — so a direct `removeAtCell` call (after zeroing hit
points, for good measure) clears terrain the player's normal tools can't scratch, bedrock
included.

## Why a hit on any part of a structure clears the whole thing

`api.structures.getAtCell` can return an instance for any cell inside a multi-cell footprint, but
calling `removeAtCell` on just the cell the brush happened to touch can leave the rest of the
building behind as a broken remnant. To avoid that, the engine looks up the instance at the hit
cell, scans a bounded area around it for every cell reporting that same instance (same type +
anchor), and removes the whole bounding box in one `removeBetweenCells` call — so clipping the
corner of a 4x4 structure clears all 16 cells, not just the ones inside the brush.

## Structure-embedded terrain (conveyors, shakers, sliding blocks)

A few `CellType` values are a machine's own moving part rendered at the terrain layer instead of
diggable ground — `SlidingBlock`, `SlidingBlockLeft/Right`, `ConveyorLeft/Right`, and
`ShakerLeft/Right`. Clearing those while leaving `Structure` off would strip half a machine and
leave the rest behind, so they're tied to the **Structure** filter instead of **Terrain**:

- `Structure` off → left alone, whether `Terrain` is on or not (counted as *"N machine terrain"*
  in the toast/panel so it's clear why nothing happened there).
- `Structure` on → cleared along with the machine, across its **whole footprint** — including any
  mechanism cells that fall outside the brush on a partial-overlap hit, the same full-footprint
  sweep described above for the structure instance itself.

## Why terrain can't be cleared under a structure (with Structure off)

If you turn the `Structure` filter off and brush over a building, you'll notice `Terrain` does
nothing on the cells the building occupies, while `Element` still clears loose matter there just
fine. That's not a bug — it's how the game itself works: `api.grid.isCellEmptyAtCell` is the
unified "is this cell free" check, and structure placement is gated on cell occupancy the same
way terrain creation is gated on `world.isCellEmpty`. In practice that means **a structure can
only be placed on ground that's already been cleared**, so there's no terrain object left under
a placed building for `getTypeAtCell` to find — the tool isn't failing to remove it, there's
genuinely nothing there. Elements are a separate simulation layer that isn't blocked by structure
occupancy the same way, which is why they still clear normally.

The panel and toast now surface this explicitly (e.g. *"…(3 more under structures — enable
Structure to clear those)"*) instead of silently doing nothing, so it's clear turning `Structure`
on is what reveals (empty) ground under a building, not a second terrain layer to dig through.

## About authorization zones

`api.authorization` only exposes **queries** — `canBuildAtCell`, `canUseToolAtCell`,
`getZoneIdAtCell` — there's no method to actually lift a zone's restriction. An earlier version
of this mod had a "No-auth" toggle that skipped the permission check before calling the removal
APIs, but that only let *this tool* act inside the zone for that one click — it never changed the
zone itself, so the cell was exactly as restricted immediately after as before. Since that didn't
do what it looked like it did, the toggle has been removed: the excavator now always respects
authorization zones and skips protected cells, the same as the game's own tools.

## Layout

| File            | Responsibility                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| `src/main.ts`    | Entry point: load persisted state, register the tool + panel, tick the overlay. |
| `src/ids.ts`     | Mod id, item/overlay ids, radius bounds, filter keys/labels, i18n keys.     |
| `src/types.ts`   | Local typing for the runtime API surface this mod uses.                    |
| `src/api.ts`     | Typed `sandkit` handle, React handle, `safe()` / `toast()`.                |
| `src/engine.ts`  | The actual cell-clearing logic (terrain/element/structure/authorization).  |
| `src/tool.ts`    | Item registration, activation detection, click/hold/keybind firing, brush overlay. |
| `src/state.ts`   | Radius/filter state, persistence via `api.storage`, panel repaint handle.  |
| `src/panel.ts`   | The injected hotbar overlay (radius stepper + filter toggles).             |
| `src/styles.ts`  | `COLORS` + panel styles.                                                    |

## Build

```
deno task check      # type-check src/main.ts
deno task build      # bundle main.js + copy modinfo/assets into build/
```

Then copy `build/` (as `excavated-all/`) into your Sandustry `mods/` folder, or set
`SANDUSTRY_MODS_DIR` and run `deno task build:toGame`.

A hand-bundled `build/main.js` is already included in this folder so the mod works even without
a Deno toolchain — re-run `deno task build:main` after editing `src/` to regenerate it faithfully.
