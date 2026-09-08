# Excavation profile

Parent: [../main/api.excavation.md](../main/api.excavation.md)

## `registerProfile(id, definition)`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Profile id referenced by items |
| `definition.pattern` | pattern | e.g. `api.patterns.createCircle(n)` |
| `definition.power` | `number` | Base dig power |
| `definition.options.fromGun` | `boolean` | Context flag |
| `definition.options.fromRocketExplosion` | `boolean` | |
| `definition.options.fromDrill` | `boolean` | |
| `definition.options.useLiteralOutVelocity` | `boolean` | |
| `definition.options.destroyNonDestructible` | `boolean` | |
| `definition.options.forceRemoveAll` | `boolean` | |
| `definition.options.drillTierDamage` | number/bool | |
| `definition.terrainRules[]` | array | Per-terrain behavior |

### `terrainRules[]` entry

| Field | Type | Description |
|---|---|---|
| `cellType` | `number` | Terrain type (alias `terrainType`) |
| `damage` | `number` optional | Damage applied |
| `outputElementType` | `number` optional | Element produced when dug |
