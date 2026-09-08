> **Entry:** Main only.  
> **Object shapes:** [definitions/api.projectiles.definition.md](../definitions/api.projectiles.definition.md)

# `api.projectiles`

| Method | Parameters | Returns |
|---|---|---|
| `register(definition)` | projectile def | `void` |
| `getDefinitionById(id)` | | definition |
| `createBlueprintById(id)` | | blueprint |
| `getAll()` / `getById(id)` | | list / instance |
| `remove(projectile)` | | `void` |
| `spawnAtWorld(worldX, worldY, angleRadians, blueprint)` | | instance |

```js
const bp = api.projectiles.createBlueprintById("myMod.bolt");
api.projectiles.spawnAtWorld(wx, wy, Math.PI / 2, bp);
```
