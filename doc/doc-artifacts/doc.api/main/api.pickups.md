> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.pickups` / `api.world.pickups`

World pickups (artifacts, drop items). Official surface under **`api.world.pickups`**.

## Methods

### `spawnAtWorld(type, worldX, worldY, data?, light?): Pickup`

| Param | Type | Description |
|---|---|---|
| `type` | `PickupType` / string | `sandkit.enums.PickupType` |
| `worldX`, `worldY` | `number` | World pixels |
| `data` | `object` optional | Instance data |
| `light` | optional | Light attachment |

### `remove(pickup): void` (alias `destroy`)
### `pickUp(pickup): void`
Player collects pickup.

### `getAll(): Pickup[]`
### `getById(pickupId): Pickup | null`

```js
api.world.pickups.spawnAtWorld(type, wx, wy, { /* data */ });
```
