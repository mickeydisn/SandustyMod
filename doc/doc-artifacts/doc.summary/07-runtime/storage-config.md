# Storage & config

```js
api.storage.ensure("author.myMod");
api.storage.set("author.myMod", "score", 10);

api.gameConfig.get("drill:maxRangeCells");
api.settings.onChange((values) => { /* … */ });
```

## API reference

- [api.storage](../../doc.api/main/api.storage.md)  
- [api.gameConfig](../../doc.api/main/api.gameConfig.md)  
- [api.config](../../doc.api/main/api.config.md)  
- [api.settings](../../doc.api/main/api.settings.md)  
- [api.constants](../../doc.api/shared/api.constants.md)  
