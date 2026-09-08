# Items & sprites

## Order

1. `await api.sprites.load` / `loadFromMod`  
2. `api.items.register`  
3. `api.player.inventory.addById`

```js
await api.sprites.loadFromMod("myMod.tool", "assets/tool.png");
api.items.register({
  id: "myMod.tool",
  sprite: { id: "myMod.tool" },
  nameKey: "mods|myMod|items|tool|name",
});
```

## API reference

- [api.items](../../doc.api/main/api.items.md) · [definition](../../doc.api/definitions/api.items.definition.md)  
- [api.sprites](../../doc.api/main/api.sprites.md)  
- [api.assets](../../doc.api/main/api.assets.md)  
- [api.cooldown](../../doc.api/main/api.cooldown.md)  
