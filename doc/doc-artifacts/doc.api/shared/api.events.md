> **Entry:** Main + Worker — event catalogs differ.

# `api.events`

Pub/sub for game and mod events.

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `on(event, handler, options?)` | ✓ | ✓ | unsubscribe / handle |
| `emit(event, payload?, options?)` | ✓ | ✓ | `void` |

### `on(eventName, handler)`

```js
api.events.on("item:used", ({ itemId, cellX, cellY }) => {
  if (itemId !== "laser") return;
  // …
});
```

### `emit(eventName, payload?)`

```js
api.events.emit("myMod.pad:changed", { x, y, state });
```

**Why namespace:** Avoid collisions (`myMod.*`).

### Typical Main events
`item:used`, `frame:render`, UI/level/building lifecycle, …

### Typical Worker events  
`update:post` (mapped from `worker:update:post`), terrain update, element pipeline events, …

Worker facade also maps some names (e.g. `terrain:updated` → `terrain:update`).
