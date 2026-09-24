# @sandmd/assets

Sprite loading helper for Sandusty-style mods. Given a list of art files, it loads each one into the
game's sprite cache (via `sandkit.api.sprites`) with a bounded concurrency pool and returns a
`{ logicalId -> spriteId }` map you can use to reference the art in structures, the catalogue, or
pickers.

Only the sprites already present in your mod folder (or a reachable path) get registered; missing
files are logged and skipped, so a broken art list never crashes boot.

## Install / import

Add `@sandmd/assets` to the Deno workspace (already present in `packages/`) and import it from a mod
entry point:

```ts
import { loadFromFileMap, loadSizedAsset, loadSpriteMap } from "@sandmd/assets";
import type { CatalogueSpriteEntry } from "@sandmd/assets";
```

## Quick start

```ts
import { loadSpriteMap } from "@sandmd/assets";

const MOD_ID = "my-mod";

const map = await loadSpriteMap(MOD_ID, [
    { id: "vase", filePath: "assets/deco/vase.png" },
    { id: "lamp", filePath: "assets/deco/lamp.png" },
]);

// -> { vase: "my-mod:vase", lamp: "my-mod:lamp" }
map.vase;
```

## API

### `loadSpriteMap(modId, entries, idPrefix?)`

Loads every entry concurrently (pooled, default concurrency `16`) and returns
`Promise<Record<string, string>>` mapping each `entry.id` to the sprite id
`${modId}:${idPrefix ?? ""}${entry.id}`.

### `loadFromFileMap(modId, fileMap, idPrefix?)`

Shorthand for `loadSpriteMap` when you already have a `{ logicalId: relativePath }` record instead
of an array of `{ id, filePath }` entries.

### `loadSizedAsset(modId, id, filePath)`

Loads a **single** sprite under the id `${modId}:${id}` and returns that id. Convenient for one-off
art (a logo, a hero structure).

### Types

- `CatalogueSpriteEntry` — `{ id: string; filePath: string }`
