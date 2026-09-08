> **Entry:** Main only.

# `api.workers`

Controls worker post-update participation from main.

## Methods

### `setPostUpdateEnabled(enabled): void`

| Param | Type | Description |
|---|---|---|
| `enabled` | `boolean` | When `true`, workers run post-update callbacks |

**Why:** Pair with worker-entry logic that listens for `update:post` / post-update events so sim mods can run after each worker tick.

```js
api.workers.setPostUpdateEnabled(true);
```

**Related:** [../worker/api.worker.md](../worker/api.worker.md), [../shared/api.events.md](../shared/api.events.md).
