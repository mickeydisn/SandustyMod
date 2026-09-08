> **Entry:** Main + Worker.

# `api.fire`

Ignite / check flammable elements at cells.

## Methods

### `canBurnElementAtCell(cellX, cellY): boolean`

| Param | Type | Description |
|---|---|---|
| `cellX` | `number` | Cell X |
| `cellY` | `number` | Cell Y |

**Returns:** `true` if the element at that cell can burn.

### `burnElementAtCell(cellX, cellY): boolean`

| Param | Type | Description |
|---|---|---|
| `cellX` | `number` | Cell X |
| `cellY` | `number` | Cell Y |

**Returns:** `true` if burn was applied.  
**Worker:** implementation short-circuits unless `canBurnElementAt` is true.

### `burnElementAtCellWhenIdle(cellX, cellY)` — Main only, deprecated alias

Deferred main-path variant; prefer worker immediate burn or `grid.mutate` patterns when coordinating with other writes.

```js
if (api.fire.canBurnElementAtCell(cx, cy)) {
  api.fire.burnElementAtCell(cx, cy);
}
```
