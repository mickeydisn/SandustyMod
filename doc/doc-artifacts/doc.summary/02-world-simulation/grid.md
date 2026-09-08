# Grid

Prefer **`api.grid`** (`api.world` is a deprecated alias).

## Quick intro

| Entry | Writes |
|---|---|
| Main | Deferred → use `mutate` for read+write |
| Worker | Immediate |

```js
api.grid.mutate((writer) => {
  writer.elements.replaceAtCell(cx, cy, waterType);
});
```

## API reference

- [api.grid](../../doc.api/shared/api.grid.md) — full method matrix  
- [api.world](../../doc.api/shared/api.world.md) — alias note  
- [api.patterns](../../doc.api/shared/api.patterns.md) — dig shapes  
- [api.excavation](../../doc.api/main/api.excavation.md) — dig profiles  
