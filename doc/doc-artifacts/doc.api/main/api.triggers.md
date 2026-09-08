> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.triggers`

Periodic main-thread callbacks.

## Methods

### `register(triggerId, definition): void`

| Param | Type | Description |
|---|---|---|
| `triggerId` | `string` | Unique id e.g. `"myMod:update"` |
| `definition.intervalMs` | `number` | Period (alias: `interval`) |
| `definition.sequentialRunCount` | `number` optional | Alias: `sequentialRuns` |
| `definition.callback` | `(trigger, deltaTimeMs) => void` | Invoked each interval |
| `definition.data` | `object` optional | Stored on trigger (alias: `extra`) |

```js
api.triggers.register("myMod:update", {
  intervalMs: 250,
  data: { counter: 0 },
  callback: (trigger, deltaTimeMs) => {
    trigger.data.counter++;
    updateExample(trigger, deltaTimeMs);
  },
});
```

Inside callback, `trigger.data` is the mutable bag from `definition.data`.
