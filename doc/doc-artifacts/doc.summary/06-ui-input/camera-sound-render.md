# Camera, sound & rendering

```js
api.camera.setFocusAtWorld(wx, wy);
api.sound.play("myMod.click", api.sound.calculateDistanceOptionsAtWorld(wx, wy, 1));

api.events.on("frame:render", () => {
  const p = api.rendering.getDrawPositionAtWorld(wx, wy);
});
```

## API reference

- [api.camera](../../doc.api/main/api.camera.md)  
- [api.sound](../../doc.api/main/api.sound.md)  
- [api.rendering](../../doc.api/main/api.rendering.md)  
- [api.lights](../../doc.api/shared/api.lights.md) · [options](../../doc.api/definitions/api.lights.definition.md)  
- [api.effects](../../doc.api/shared/api.effects.md)  
