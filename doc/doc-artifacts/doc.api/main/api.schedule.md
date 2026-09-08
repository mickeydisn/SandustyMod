> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.schedule`

### `nextTick(callback): void`

| Param | Type | Description |
|---|---|---|
| `callback` | `() => void` | Runs on the next main tick |

```js
api.schedule.nextTick(() => {
  runDeferredWork();
});
```

**Why:** Defer work off the current stack (after mutations, after UI events).
