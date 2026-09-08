> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.raycast`

World ray queries for tools/weapons.

## Methods

### `castAtWorld(startWorldX, startWorldY, angleRadians, maxDistanceWorldPixels): Result`
Alias: `castFromWorld` (deprecated name).

| Param | Type | Description |
|---|---|---|
| `startWorldX` | `number` | Origin X (world px) |
| `startWorldY` | `number` | Origin Y |
| `angleRadians` | `number` | Direction |
| `maxDistanceWorldPixels` | `number` | Max length |

### Result

| Field | Type | Notes |
|---|---|---|
| `cellX` | `number` | Hit cell X (alias `x`) |
| `cellY` | `number` | Hit cell Y (alias `y`) |
| `distanceWorldPixels` | `number` | Distance (alias `distance`) |

```js
const hit = api.raycast.castAtWorld(wx, wy, angle, 500);
if (hit) {
  api.grid.excavateAtCell(hit.cellX, hit.cellY, { x: 0, y: -120 }, 10);
}
```
