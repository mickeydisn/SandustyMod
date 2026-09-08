# Fire & dig patterns

## Fire

```js
if (api.fire.canBurnElementAtCell(cx, cy)) {
  api.fire.burnElementAtCell(cx, cy);
}
```

## Patterns

```js
api.patterns.excavateAtCell(
  cx, cy,
  api.patterns.createCircle(5),
  { x: 0, y: -120 },
  2,
);
```

## API reference

- [api.fire](../../doc.api/shared/api.fire.md)  
- [api.patterns](../../doc.api/shared/api.patterns.md)  
- [api.grid.excavateAtCell](../../doc.api/shared/api.grid.md)  
- [api.excavation profiles](../../doc.api/main/api.excavation.md) · [definition](../../doc.api/definitions/api.excavation.definition.md)  
