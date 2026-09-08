# Energy definition

Parent: [../main/api.energy.md](../main/api.energy.md)

## `registerType(structureId, type, options?)`

| Param | Type | Description |
|---|---|---|
| `structureId` | `string` | Must match `structures.register` id |
| `type` | `"conductor" \| "storage"` | Graph role |
| `options.priority` | `number` optional | Network priority |

## Network entry from `getNetworkAtCell`

| Field | Type | Description |
|---|---|---|
| `cellX` | `number` | Alias `x` |
| `cellY` | `number` | Alias `y` |
| `type` | `string` | `conductor` / `storage` |

## `adjust` paths

`addAtCell(cellX, cellY, amount, options?)` — inject energy at cell.  
`consume(amount, options?)` — draw from available network.  
`getNetworkFreeCapacityAtCell(cellX, cellY)` — remaining storage capacity.
