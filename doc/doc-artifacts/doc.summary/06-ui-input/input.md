# Input

```js
api.input.registerBinding("myMod.toggle", ["KeyO"], {
  nameKey: "mods|myMod|bindings|toggle",
});
const cell = api.input.getMousePositionAtCell();
```

For **structure click/use**, prefer signals interactables — not mouse polling.

## API reference

- [api.input](../../doc.api/main/api.input.md)  
- [api.action](../../doc.api/main/api.action.md)  
- [api.signals](../../doc.api/main/api.signals.md)  
