# UI & i18n

Worker can **`toast` only**. Full UI is Main.

```js
api.i18n.register("en", { "mods|myMod|title": "My Mod" });
api.ui.toast({ key: "mods|myMod|title" });
```

## API reference

- [api.ui](../../doc.api/main/api.ui.md)  
- [api.i18n](../../doc.api/main/api.i18n.md)  
