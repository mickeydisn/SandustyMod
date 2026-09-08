# Excavation profiles

```js
api.excavation.registerProfile("myMod:drill", {
  power: 8,
  terrainRules: [
    {
      cellType: api.terrains.getTypeById("dune"),
      outputElementType: api.elements.getTypeById("sand"),
    },
  ],
});
```

## API reference

- [api.excavation](../../doc.api/main/api.excavation.md)  
- [definition](../../doc.api/definitions/api.excavation.definition.md)  
- [api.patterns](../../doc.api/shared/api.patterns.md)  
