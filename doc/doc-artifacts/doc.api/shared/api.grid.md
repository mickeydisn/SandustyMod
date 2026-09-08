> **Entry:** Main + Worker — methods differ.  
> Prefer **`api.grid`** over deprecated **`api.world`**.

# `api.grid`

Grid topology and safe mutation API.

---

## Availability

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `getDimensions()` | ✓ | ✓ | `{ widthCells, heightCells }` |
| `getCellIdAtCell(cx, cy)` | ✓ | ✓ | `cellId` |
| `isCellEmptyAtCell(cx, cy)` | ✓ | ✓ | `boolean` |
| `isTerrainAtCell(cx, cy)` | ✓ | ✓ | `boolean` |
| `mutate(callback)` | ✓ | — | `void` |
| `reportActivityAtCell(cx, cy)` | ✓ | ✓ | `void` |
| `excavateAtCell(cx, cy, outVelocity, damage, options?)` | ✓ | ✓ | `void` |
| `revealFogAtCell(cx, cy)` | ✓ | — | `void` |
| `redrawAroundCell(cx, cy, rangeCells)` | ✓ | — | `void` |
| `forEachCellInRectangle(...)` / `forEachCellInCircle(...)` | ✓ | — | `void` |

---

## `getDimensions(): { widthCells: number, heightCells: number }`

Map size in cells.

## `mutate(callback: (writer) => void): void` — Main critical path

**Why:** On Main, direct `elements.*` writes are deferred; a following read can still see the old cell. `mutate` runs a coherent write batch.

```js
api.grid.mutate((writer) => {
  writer.elements.replaceAtCell(cx, cy, waterType);
  writer.terrains.removeAtCell(cx, cy);
  writer.reportActivityAtCell(cx, cy);
});
```

### `writer` methods

| Method | Role |
|---|---|
| `elements.createAtCell(cx, cy, type, options?)` | Create element |
| `elements.replaceAtCell(cx, cy, type, options?)` | Replace element |
| `elements.removeAtCell(cx, cy, options?)` | Remove element |
| `terrains.createAtCell` / `replaceAtCell` / `removeAtCell` | Terrain ops |
| `reportActivityAtCell(cx, cy)` | Wake sim chunk |

Deprecated alias: `api.world.runWhenSimulationIdle(callback)`.

## `excavateAtCell(cx, cy, outVelocity, damage, options?)`

Digs using damage/velocity; pairs with `api.patterns` / `api.excavation` profiles.

```js
api.grid.excavateAtCell(cx, cy, { x: 0, y: -120 }, 25);
```

## `reportActivityAtCell(cx, cy)`

Marks the chunk active so simulation continues processing that region.
