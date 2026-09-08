> **Entry:** Main only.

# `api.building`

Build-placement UI helpers.

## Methods

### `selectStructure(structureTypeOrId): void`

| Param | Type | Description |
|---|---|---|
| `structureTypeOrId` | `string` | Structure to enter place mode for |

No-ops or blocked while `api.tools.grabber.isLoaded()`.

### `getSnappedPositionAtCell(cellX, cellY): position`
Snap helper using grid metrics / build rules.

| Param | Type | Description |
|---|---|---|
| `cellX`, `cellY` | `number` | Cursor cell |

### `isBlockedAtCell(cellX, cellY): boolean`
Whether placement is blocked at cell (player, rules, occupancy).

### `cancelPlacement(): void`
Exits current placement mode.
