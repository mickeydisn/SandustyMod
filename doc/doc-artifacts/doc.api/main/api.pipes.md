> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.pipes`

Pipe network queries and enable flags.

## Methods

### `isAtCell(cellX, cellY): boolean`
Whether a pipe occupies the cell.

### `isEnabledAtCell(cellX, cellY): boolean`
Whether pipe at cell is enabled.

### `getConnectedVentsAtCell(cellX, cellY): vents`
Connected vent endpoints for the pipe graph at cell.

### `setEnabledAtCell(cellX, cellY, enabled): void`

| Param | Type | Description |
|---|---|---|
| `cellX`, `cellY` | `number` | Cell coords |
| `enabled` | `boolean` | On/off |

```js
if (api.pipes.isAtCell(cx, cy)) {
  api.pipes.setEnabledAtCell(cx, cy, true);
}
```
