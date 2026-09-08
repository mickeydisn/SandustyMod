# Processing & recipes

## Processing

```js
api.structures.processing.register("myMod.machine:tick", {
  structureType: "myMod.machine",
  intervalMs: 250,
  process: (structure, context) => { /* … */ },
});
```

## Recipes

```js
api.structures.recipes.register("kineticPress", {
  input: "sand",
  outputs: [{ elementType: "compressedSand", chance: 1 }],
  minimumDownwardVelocityCellsPerSecond: 20,
});
```

## API reference

- Processing + recipes sections in [Structure definition](../../doc.api/definitions/api.structures.definition.md)  
- [api.structures](../../doc.api/shared/api.structures.md)  
- [api.recipes](../../doc.api/shared/api.recipes.md) (if present)  
