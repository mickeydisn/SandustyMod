# Events & hooks

| | Events | Hooks |
|---|---|---|
| Role | Observe / emit | Cancel or transform pipelines |
| Example | `item:used`, `frame:render` | `element:move`, `action:intercept` |

```js
api.events.on("item:used", ({ itemId, cellX, cellY }) => { /* … */ });
api.hooks.intercept("element:move", (payload, ctx) => { /* ctx.cancel? */ });
```

## API reference

- [api.events](../../doc.api/shared/api.events.md)  
- [api.hooks](../../doc.api/shared/api.hooks.md)  
- Worker: [api.main.emitEvent](../../doc.api/worker/api.main.md)  
