# Random Artefact (`md-random-artefact`) · v0.3.2

Category **Artefact**. Sprites: **16×16 frames in a horizontal row**.

## Structures

| Structure | Max | Notes |
|-----------|-----|--------|
| **Artefact Generator** | 1 | Eats Gold×1 / Copper×0.5 / Sand×5 (inverse weight). Signal or click → spawn artefact (max 5 live). Shape 4×4 of **0**. |
| **Terrain Collector** | 1 | Manual only (no signal). Click when charged → 64×64 stamp from Dicebear icon. White→**dirt**, 1px outline→**moss**. Shape 4×4 of **0**. |
| **Material links** | — | Gold / Copper / Sand pads — active when generator cycle matches. |
| **Artefact** | hidden | Emits elements then removes. |
| **Display** | — | Nearby generator remaining charge. |

## Assets

| File | Size |
|------|------|
| `generator.png` | 48×16 (3 frames) |
| `terrain-collector.png` | 32×16 (2 frames) |
| `material-*.png` | 32×16 (2 frames) |
| `artefact.png` / `display.png` | 16×16 |

## Build

```bash
deno task build
```

Copy `build/` into the game mods folder. Toast must show **v0.3.2**.
