> **Entry:** Main + Worker — targets differ.

# `api.hooks`

Interception / transformation of engine pipelines (stronger than events).

| Method | Parameters | Returns |
|---|---|---|
| `intercept(event, handler, options?)` | handler may receive context with `cancel()` | unsubscribe |
| `modify(event, handler, options?)` | transform payload | unsubscribe |

```js
api.hooks.intercept("element:move", (payload, context) => {
  // context.cancel?.()
}, { guard: { /* element filters */ } });
```

**Worker-oriented hooks:** element move, blocked movement, duration expiry, burn, shaker, …  
**Main-oriented hooks:** `action:intercept` (interactables), `interactable:suppressHover`, excavation modifiers, …

**Why hooks vs events:** Hooks can cancel or modify engine behavior; events are observational.
