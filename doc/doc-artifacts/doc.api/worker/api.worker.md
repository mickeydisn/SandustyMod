> **Entry:** Worker only.

# `api.worker`

## Methods

### `getIndex(): number`
Index of this simulation worker in the pool (`0 .. count-1`).

### `getCount(): number`
Number of simulation workers.

```js
const i = api.worker.getIndex();
const n = api.worker.getCount();
// shard: only run when structure hash % n === i
```
