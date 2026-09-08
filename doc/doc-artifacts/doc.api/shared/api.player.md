> **Entry:** Main + Worker — methods differ.

# `api.player`

Player avatar and inventory.

---

## Availability

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `getPositionAtWorld()` | ✓ | ✓ | `{ x, y }` |
| `setPositionAtWorld(x, y)` | ✓ | — | `void` |
| `setVelocity(vx, vy)` | ✓ | — | `void` |
| `setMovementSpeedMultiplier(m)` | ✓ | — | `void` |
| `setMovementMode(mode)` | ✓ | — | `void` |
| `isOnGround()` | ✓ | — | `boolean` |
| `teleportToGround()` | ✓ | — | `void` |
| `isCollidingWithCell(cx, cy)` | ✓ | ✓ | `boolean` |
| `isWithinRadiusOfCell(cx, cy, r)` | ✓ | ✓ | `boolean` |
| `isPositionClearAtWorld(wx, wy)` | ✓ | — | `boolean` |
| `inventory.hasById(itemId)` | ✓ | — | `boolean` |
| `inventory.addById(itemId)` | ✓ | — | `void` |

`setMovementMode(mode: "normal" | "hover")`

### Buildings (Main)

See [api.player.buildings.md](api.player.buildings.md):

```js
api.player.buildings.unlockById("myMod.structure");
api.player.buildings.removeById("myMod.structure");
```

**Why Worker is read-mostly:** Simulation workers need collision/position checks; inventory and movement authority stay on Main.
