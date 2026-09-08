> **Entry:** Main only.  
> **Object shapes:** [definitions/api.excavation.definition.md](../definitions/api.excavation.definition.md)

# `api.excavation`

| Method | Parameters | Returns |
|---|---|---|
| `registerProfile(id, definition)` | profile id + rules | `void` |

```js
api.excavation.registerProfile("myMod:drill", {
  power: 8,
  options: { fromDrill: true, drillTierDamage: 1 },
  terrainRules: [
    {
      cellType: api.terrains.getTypeById("dune"),
      outputElementType: api.elements.getTypeById("sand"),
    },
  ],
});
```

**How used:** Items/weapons reference the profile id; runtime dig uses `api.patterns.excavateAtCell` / `api.grid.excavateAtCell` with power and velocity.
