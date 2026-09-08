# Elements

Simulated matter inside cells.

## Quick intro

- **Register** new types on **Main** only.  
- Worker can create/move/swap immediately.  
- Options: `{ durationTicks }` on create/replace.

```js
api.elements.createAtCell(cx, cy, "water", { durationTicks: 60 });
```

## API reference

- [api.elements](../../doc.api/shared/api.elements.md) — Main vs Worker matrix  
- [Element definition](../../doc.api/definitions/api.elements.definition.md) — register fields & cell options  
- [api.constants.physics](../../doc.api/shared/api.constants.md) — `setPhysicsAtCell`  
- [api.collector](../../doc.api/shared/api.collector.md) — collectable values  
