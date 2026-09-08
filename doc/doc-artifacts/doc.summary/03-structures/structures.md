# Structures

## Quick intro

```js
api.structures.register({
  id: "myMod.pad",
  categoryKey: "logic",
  buildModes: [{ type: "single" }],
  shape: [[1]],
  defaultData: { state: 0 },
});
api.player.buildings.unlockById("myMod.pad");
```

Clicks: use `api.signals.interactables.register` (not mouse polling).

## API reference

- [api.structures](../../doc.api/shared/api.structures.md) — full matrix  
- [Structure definition](../../doc.api/definitions/api.structures.definition.md) — buildModes, placement, tooltip  
- [api.building](../../doc.api/main/api.building.md) — placement UI  
- [api.authorization](../../doc.api/main/api.authorization.md) — canBuild zones  
- [api.player.buildings](../../doc.api/shared/api.player.buildings.md) — unlock  
