# Signals

Main-entry only.

## Quick intro

| API | Role |
|---|---|
| `interactables.register` | Player click/use |
| `targets.register` | Incoming link graph changed |
| `registerSenderType` | Structure can output signal |
| `setOutputAtCell` | Drive output on/off |

```js
api.signals.interactables.register("myMod.lever", (structure) => {
  structure.data.on = !structure.data.on;
  api.structures.update(structure);
});
```

## API reference

- [api.signals](../../doc.api/main/api.signals.md)  
- [Signals payloads](../../doc.api/definitions/api.signals.definition.md)  
- [Example 01](../../doc.exemple/01-signal-state-structure.md)  
