# Sandustry Icons

`sandustry.icons` · v1.0.0 · **progress**

Decorative placement mod — a **deco-style picker with no cost**. Adds ~2900 icon objects across 29
categories to the build menu, with a picker overlay, tag/size filters and a mirror toggle.

## Features

- One build-menu entry: **Icons**.
- Picker overlay with categories, tag/size filters and a mirror toggle.
- Structures use `copyData: true` for paste-friendly metadata.
- No wallet, vouchers, or placement intercept — placement is free.
- Structures are registered per catalogue item × mirror state (`typeOfCatalogueItem`), each with its
  own aligned custom draw (`buildCustomDraw`).

## Package dependencies

| Package             | Used for                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@sandmd/sandkit`   | Global `sandkit` declaration.                                                                                                |
| `@sandmd/catalogue` | `createBuildList`, `createPickerOverlay`, `buildStructureDefinition`, `makeShape`, `buildCustomDraw`, `typeOfCatalogueItem`. |
| `@sandmd/assets`    | `loadSpriteMap` — concurrent sprite loading for the whole catalogue.                                                         |
| `@sandmd/modkit`    | `findOrphanedObjects`, `pruneStaleBuildings` — boot-time leftovers pass.                                                     |

## Sandkit API used

| Area       | Calls                                                                        |
| ---------- | ---------------------------------------------------------------------------- |
| Structures | `structures.register` (via `buildStructureDefinition`'s returned definition) |
| Player     | `player.buildings.unlockByType` (menu entry + picker unlocks)                |
| UI         | `ui.toast`                                                                   |
| i18n       | Per-item name/description keys, `categoryKey: "blocks"`                      |

## Catalogue generation

`src/catalogue.generated.ts` is **auto-generated** — do not edit. Regenerate it after adding or
removing PNG sprites:

```sh
deno task build:img          # node tools/generate-catalogue.mjs
```

It exports:

- `ICON_CATEGORIES` — 29 `CatalogueCategory` entries (arraw, banner, beacon, bg, block, bot, char,
  …)
- `ICON_FILES` — the sprite file list passed to `loadSpriteMap`
- `ICON_ITEMS` — the ~2900 `CatalogueItem` entries (id, label, width, height, align, description)

`assets/` holds the source PNG folders (`block`, `deco`, `icons`); `assets2/` is a secondary art
set. `assets/MANIFEST.md` documents the art layout.

## License

MIT

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
