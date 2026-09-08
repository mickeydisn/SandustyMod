# Sandustry API — `api.player` & `api.player.buildings`

> **Entry:** Main + Worker. Official: [sandkit.html](https://sandustry.com/sandkit.html). Grid writes: deferred on main, immediate on worker.


Player transform, inventory, and unlocked building list.

---

## Surface

```ts
api.player.getPosition() → { x, y }          // world pixels
api.player.setPosition(x, y)
api.player.setVelocity(vx, vy)
api.player.setMovementSpeedMultiplier(m)
api.player.setMovementMode(mode)
api.player.isOnGround() → boolean
api.player.teleportToGround()
api.player.isCollidingWithCell(cellX, cellY) → boolean
api.player.isWithinRadius(cellX, cellY, radiusPixels) → boolean
api.player.isPositionClear(worldX, worldY) → boolean

api.player.inventory.has(itemId) → boolean
api.player.inventory.add(itemIdOrInstance)

api.player.buildings.add(structureTypeId)
api.player.buildings.remove(structureTypeIdOrRef) → boolean
```

| Path | Role |
|---|---|
| `store.player` | x, y, velocity, inventory, buildings, action, tech, … |
| `shared.playerPos` | SAB mirror `[x, y]` for workers |
| `session.movementSpeedMultiplier` | Speed scale |

---

## Movement & collision

| Method | Detail |
|---|---|
| `getPosition()` | Prefers `store.player`, else `shared.playerPos`, else `{0,0}` |
| `setPosition(x, y)` | World pixels |
| `setVelocity(vx, vy)` | Writes `store.player.velocity` |
| `setMovementSpeedMultiplier(m)` | Session multiplier |
| `setMovementMode(mode)` | Engine movement mode switch |
| `isOnGround()` | Ground contact |
| `teleportToGround()` | Snap down to surface |
| `isCollidingWithCell(cx, cy)` | AABB vs cell rect |
| `isWithinRadius(cx, cy, r)` | Distance from player center to cell center ≤ `r` (pixels) |
| `isPositionClear(wx, wy)` | True if player AABB at that world pos has no terrain cells |

---

## `inventory`

### `has(itemId)`

True if any inventory entry has `.id === itemId`.

### `add(itemIdOrInstance)`

```ts
itemIdOrInstance: number | string
// number → built-in item factory
// string → api.items.create(id)
```

Throws if the item cannot be created. Pushes onto `store.player.inventory`.

```js
api.player.inventory.add("myMod.wand");
api.player.inventory.add(enums.ItemId.Shovel);
```

---

## `buildings` — unlocked buildables

`store.player.buildings` is a list of structure type ids the player may place (tech/unlock driven).

### `add(structureTypeId)`

Appends if not already present (idempotent).

```ts
structureTypeId: string | number
```

### `remove(structureTypeIdOrRef) → boolean`

Removes matching entries by value or `.id`. Returns whether anything was removed. Refreshes Management UI on success.

```js
api.player.buildings.add("myMod.reactor");
api.player.buildings.remove("myMod.reactor");
```

Related: `api.structures.isUnlocked` / `getUnlockedTypes` for the broader unlock set used by the build UI.

---

## Example

```js
const { x, y } = api.player.getPosition();
if (api.player.isWithinRadius(cellX, cellY, 64)) {
  api.player.inventory.add("myMod.loot");
}
```

---

## Notes

- Coordinates: position APIs use **world pixels**; cell helpers take **cell indices**.
- After `setPosition`, keep `shared.playerPos` in sync if you rely on workers (engine usually does this on teleport helpers).
- `api.teleportZones.teleportPlayerTo` is preferred for polished teleports (VFX, velocity reset).
