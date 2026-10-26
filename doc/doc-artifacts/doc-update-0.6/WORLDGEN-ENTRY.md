# Worldgen Entry & External Maps (0.6.0)

The 0.6.0 loader contains an explicit path for **external worldgen mods** and richer custom-map support.

## Manifest signal

Mods that participate in world generation declare a `worldgenEntry` (exact shape still being stabilised in the public docs). The loader also recognises external map discovery and blueprints.

## What the loader already supports

When a new game is started with procgen / external map options the engine can load:

| Blueprint / data          | Purpose |
|---------------------------|---------|
| `terrain`                 | Main terrain image / data |
| `lights` + `lightsMeta`   | Lighting layer |
| `sensors`                 | Sensor placements |
| `authorization`           | Ownership / zone data |
| `wall`                    | Wall tiles + optional palette |
| `prefabPlacements`        | Prefab instances |
| `foliageClusters`         | Foliage |
| `wallCracks`              | Visual cracks |
| `externalMapProfile`      | Map profile metadata |
| `externalMapColorMappings`| Colour → element / terrain mapping |
| `worldgenDepositCounts`   | Deposit statistics |
| `worldgenPropIds`         | Prop identifiers |

Progress is reported through the loading UI (`ui|loading|procgen|…` keys) and optional lore text.

## Procgen debug helpers present in 0.6

- Optional ambient music during generation.  
- “Show generated map” overlay with legend, click-to-inspect, and placement report.  
- “Save generated map” path that writes a named map entry using the current seed and parameters.

## Integration points for mod authors

1. Declare the worldgen capability in `modinfo.json`.  
2. Supply the entry that the loader will execute (the exact export surface is still best discovered by inspecting diagnostics and the live game).  
3. Prefer the official sandbox map APIs (`sandkit.api.maps`, external-map helpers) when they become fully documented.  
4. Always handle the case where the player has already selected a different external map or provider.

## Diagnostics

Worldgen / external-map failures surface as ordinary loader diagnostics (same structure used by texture and shader overrides). Check the in-game Mods / loading log for codes that mention the map or worldgen field.

## Practical advice

- Keep generated maps deterministic from a seed when possible.  
- Respect the existing colour-mapping and blueprint contracts so vanilla systems (lights, sensors, authorization) continue to work.  
- Test both “new game with your worldgen” and “load an existing save that never knew about your mod”.