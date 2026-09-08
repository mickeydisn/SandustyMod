> **Entry:** Main + Worker. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.shared.buffers`

SharedArrayBuffer helpers across main and workers.

## Methods

### `ensure(key, config): TypedArray` (alias `create`)

| Param | Type | Description |
|---|---|---|
| `key` | `string` | Global buffer key |
| `config.type` | `string` | e.g. `"uint32"`, `"float32"` |
| `config.length` | `number` | Element count |

**Returns:** typed array view.

### `get(key): TypedArray | undefined`
### `require(key): TypedArray` (Worker lists `require` — throws if missing)

```js
const counts = api.shared.buffers.ensure("myMod.counts", {
  type: "uint32",
  length: 4,
});
counts[0] += 1;
```

**Why:** Cross-thread counters; launcher `runTickSharedBufferKey` uses the same mechanism.
