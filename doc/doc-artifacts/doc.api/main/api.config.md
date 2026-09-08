# Sandustry API — `api.config`

> **Entry:** Main only (`manifest.entry`). Official: [sandkit.html](https://sandustry.com/sandkit.html).


Engine configuration constants and runtime overrides.

---

## Surface

```ts
api.config(key) → any                 // callable getter
api.config.getLegacy() → ConfigObject // full constants object
api.config.set(key, value)            // runtime override
```

`api.config` is both a **function** and an object with `getLegacy` / `set`.

---

## Legacy constants (`getLegacy()`)

Default values from the bundle:

```ts
{
  version: string | number;
  fps: 60;
  lockFps: boolean;                 // default false
  chunkSize: 40;                    // sim chunk size (cells)
  cellSize: 4;                      // pixels per cell
  gravity: number;                  // ≈ 0.06 * 60 * 60
  upflow: number;                   // ≈ 60 * -0.36
  snapGridCellSize: 4;              // structure snap grid (cells)
  startingResources: 0;

  debug: {
    active: boolean;
    showUnderlyingCellsInStructures: boolean;
    drawChunks: boolean;
    drawChunkFade: number;
    drawRulers: boolean;
    showThreadLoad: boolean;
    controls: boolean;
    defaultBaseHue: number;
    brushSize: number;
    brushShape: "circle" | string;
    brushThrottle: number;
    highlightBrush: boolean;
    preventDuplicateCells: boolean;
    doNotDrawStructures: boolean;
    stopOnDebugCellUpdate: boolean;
    overrideLightSize: boolean;
    overrideTerrainShadow: boolean;
    lightSize: number;
    terrainShadowValue: number;
    flashlight: {
      brightness: number;
      size: number;
      duration: number;
      color: [r, g, b, a];
    };
  };

  // also present on the live object:
  // playerSize: { width, height }
  // obstacleBreakpoint: number  // terrain materialId must be > this and < 150
}
```

Prefer reading at runtime:

```js
const cfg = api.config.getLegacy();
const px = cfg.cellSize;            // 4
const snap = cfg.snapGridCellSize;  // 4
```

---

## Get / set single keys

```js
const value = api.config("cellSize");
api.config.set("someKey", value);   // use sparingly
```

---

## Values mods use most

| Key | Use |
|---|---|
| `cellSize` | Cell → world pixels |
| `snapGridCellSize` | Structure placement grid |
| `playerSize` | Collision / radius |
| `obstacleBreakpoint` | Terrain `materialId` range |
| `chunkSize` | Chunk activity |

---

## Example

```js
const { cellSize } = api.config.getLegacy();
const worldX = cellX * cellSize;
const worldY = cellY * cellSize;
```

---

## Notes

- Treat most constants as **read-only** unless you know the sim re-reads them.
- `obstacleBreakpoint` is enforced when registering terrains with `materialId`.
