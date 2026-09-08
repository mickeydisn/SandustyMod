# Terrain definition & cell options

Parent: [../shared/api.terrains.md](../shared/api.terrains.md)

## `register(definition)` — Main only

```ts
{
  id: string;
  name?: string;
  nameKey?: string;
  hp?: number;                         // hit points
  materialId?: number;                 // must respect obstacleBreakpoint rules if set
  // colors, dig outputs, melt targets — engine-dependent
}
```

## Cell ops

```ts
// damage / melt / setHp — amount or options as per method
api.terrains.damageAtCell(cx, cy, damage);
api.terrains.setHpAtCell(cx, cy, hp);
api.terrains.meltAtCell(cx, cy);
```

`WhenIdle` aliases on Main only.
