> **Entry:** Main only.

# `api.authorization`

Build/tool permission zones.

## Methods

### `canBuildAtCell(cellX, cellY): boolean`
### `canGrabAtCell(cellX, cellY): boolean`
### `canUseTool(player, isFlamethrower?): boolean`
### `canUseToolAtCell(cellX, cellY, isFlamethrower?): boolean`

| Param | Type | Description |
|---|---|---|
| `cellX`, `cellY` | `number` | Cell |
| `isFlamethrower` | `boolean` optional | Tool-specific rule path |
| `player` | player ref | For `canUseTool` |

### `getZoneIdAtCell(cellX, cellY): zoneId`
### `getPlayerZoneId(): zoneId`

```js
if (!api.authorization.canBuildAtCell(cx, cy)) return;
api.structures.buildAtCell(cx, cy, "myMod.block");
```
