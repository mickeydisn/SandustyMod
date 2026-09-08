> **Entry:** Main only.

# `api.gameConfig`

Merged game + mod config (drill, vacuum, transport, …).

## Methods

### `get(key): any`

| Param | Type | Description |
|---|---|---|
| `key` | `string` | `"namespace:path"` e.g. drill settings |

### `getAll(): object`
Full config object.

### Deprecated key aliases
| Old | New |
|---|---|
| `drill:maxRange` | `drill:maxRangeCells` |
| `drill:normalExcavationRate` | `drill:normalExcavationChance` |
| `drill:reducedExcavationRate` | `drill:reducedExcavationChance` |
