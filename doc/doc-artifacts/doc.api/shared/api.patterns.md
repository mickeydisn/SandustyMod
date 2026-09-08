> **Entry:** Main + Worker.

# `api.patterns`

## Methods

### `createCircle(diameterCells): Pattern`

| Param | Type | Description |
|---|---|---|
| `diameterCells` | `number` | Circle diameter in cells (often odd) |

**Returns:** opaque pattern object for excavate.

### `excavateAtCell(cellX, cellY, pattern, outVelocity, power, options?): void`

| Param | Type | Description |
|---|---|---|
| `cellX`, `cellY` | `number` | Center cell |
| `pattern` | Pattern | From `createCircle` |
| `outVelocity` | `{ x, y }` | Ejection velocity |
| `power` | `number` | Dig power |
| `options` | `object` optional | Extra dig flags |

```js
api.patterns.excavateAtCell(
  cx, cy,
  api.patterns.createCircle(5),
  { x: 0, y: -120 },
  2,
);
```
