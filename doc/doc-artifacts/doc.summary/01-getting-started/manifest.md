# Mod layout & manifest

## Typical tree

```
my-mod/
├── modinfo.json          # required
├── main.js               # manifest.entry
├── worker.js             # manifest.workerEntry (optional)
├── patches.json          # optional binary patches
├── assets/
├── config/
└── map/                  # custom maps
```

## Minimal `modinfo.json`

```json
{
  "manifestVersion": 1,
  "id": "author.example-mod",
  "name": "Example Mod",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "main.js"
}
```

Add `"workerEntry": "worker.js"` for simulation-side logic.

## Main vs Worker (why both?)

| Concern | Prefer |
|---|---|
| Register types, UI, input, signals click | **Main** |
| Per-tick element/structure sim | **Worker** |
| Grid write that depends on a read (Main) | `api.grid.mutate` |

Official overview: [sandkit.html](https://sandustry.com/sandkit.html) — Mod file structure / Manifest.

## API references

- [api.game](../../doc.api/main/api.game.md) — `start({ skipIntro })`
- [api.scene](../../doc.api/main/api.scene.md) — gate menu-only calls
- [api.maps](../../doc.api/shared/api.maps.md) — custom maps
