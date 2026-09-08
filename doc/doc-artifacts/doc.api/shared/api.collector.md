> **Entry:** Main + Worker — same surface.

# `api.collector`

Sell/collect values for element cells.

## Methods

### `getValueFromCellId(cellId): number`

| Param | Type | Description |
|---|---|---|
| `cellId` | `number` | Packed cell id from grid |

### `getValueByType(elementType): number`

| Param | Type | Description |
|---|---|---|
| `elementType` | number/type | Element type |

### `isCellIdCollectable(cellId): boolean`
### `isCellIdCollectableForSprite(cellId): boolean`
Sprite path may differ slightly for VFX.

### `notifyPickupAtCell(cellX, cellY): void`
Notifies collector UI/accounting that a pickup occurred at cell.

```js
const id = api.grid.getCellIdAtCell(cx, cy);
if (api.collector.isCellIdCollectable(id)) {
  const v = api.collector.getValueFromCellId(id);
}
```
