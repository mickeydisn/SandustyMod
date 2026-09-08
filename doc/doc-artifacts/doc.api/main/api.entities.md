> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.entities`

Sparse non-grid entities (pets, drones, capturable objects). Not structures, not elements.

## Methods

### `getById(entityId): Entity | null`
Lookup one entity by id.

| Param | Type | Description |
|---|---|---|
| `entityId` | `string \| number` | Entity instance id |

### `getAllByType(entityTypeId): Entity[]`
All live instances of a type.

| Param | Type | Description |
|---|---|---|
| `entityTypeId` | `string` | Registered entity type id |

### `spawnAtWorld(entityTypeId, worldX, worldY): entityId`
Spawns at **world pixel** coordinates (not cells).

| Param | Type | Description |
|---|---|---|
| `entityTypeId` | `string` | Type to spawn |
| `worldX` | `number` | World X pixels |
| `worldY` | `number` | World Y pixels |

**Returns:** new entity id.

### `remove(entityId): void`
Despawns entity.

### `launch(entityId, angleRadians, speed?): void`
Applies impulse.

| Param | Type | Description |
|---|---|---|
| `entityId` | id | Target |
| `angleRadians` | `number` | Direction |
| `speed` | `number` optional | Speed magnitude |

### `startCapture(entityId): void` / `collect(entityId): void`
Capture/collect flows (pets, pickups-style entities).

```js
const id = api.entities.spawnAtWorld("examplePet", wx, wy);
api.entities.launch(id, Math.PI / 2, 40);
```
