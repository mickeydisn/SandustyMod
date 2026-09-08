# Energy, conveyors & launchers

## Energy

```js
api.energy.registerType("myMod.battery", "storage", { priority: 5 });
api.energy.registerType("myMod.cable", "conductor");
```

## Belts / launchers

```js
api.structureBehaviors.registerConveyorType("myMod.belt", { runWith: "right" });
api.structureBehaviors.registerLauncherType({ /* up/left/right + velocity */ });
```

## API reference

- [api.energy](../../doc.api/main/api.energy.md) · [definition](../../doc.api/definitions/api.energy.definition.md)  
- [api.structureBehaviors](../../doc.api/main/api.structureBehaviors.md)  
- [api.conveyors](../../doc.api/main/api.conveyors.md) · [api.launchers](../../doc.api/main/api.launchers.md)  
- [api.pipes](../../doc.api/main/api.pipes.md)  
