> **Entry:** Main + Worker.

# `api.random`

Engine RNG helpers (prefer over `Math.random()` for gameplay rolls).

## Methods

### `int(min, max): number`

| Param | Type | Description |
|---|---|---|
| `min` | `number` | Inclusive lower bound |
| `max` | `number` | Inclusive upper bound |

**Returns:** integer in `[min, max]`.

### `float(min, max): number`

| Param | Type | Description |
|---|---|---|
| `min` | `number` | Lower bound |
| `max` | `number` | Upper bound |

**Returns:** floating-point value in range.

```js
const roll = api.random.int(1, 100);
const t = api.random.float(0, 1);
```
