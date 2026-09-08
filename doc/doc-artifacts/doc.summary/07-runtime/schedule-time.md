# Schedule, triggers & time

```js
api.schedule.nextTick(() => { /* deferred main work */ });

api.triggers.register("myMod:pulse", {
  intervalMs: 250,
  callback: (trigger, deltaTimeMs) => { /* … */ },
});

const tick = api.time.getTick();
```

## API reference

- [api.schedule](../../doc.api/main/api.schedule.md)  
- [api.triggers](../../doc.api/main/api.triggers.md)  
- [api.time](../../doc.api/main/api.time.md)  
