# @sandmd/assets

Sprite loading helper for Sandusty-style mods. Given a list of art files, it
loads each one into the game's sprite cache (via `sandkit.api.sprites`) with a
bounded concurrency pool and returns a `{ logicalId -> spriteId }` map you can
use to reference the art in structures, the catalogue, or pickers.

Only the sprites already present in your mod folder (or a reachable path) get
registered; missing files are logged and skipped, so a broken art list never
crashes boot.

## Install / import

Add `@sandmd/assets` to the Deno workspace (already present in `packages/`) and
import it from a mod entry point:

```ts
import { loadSpriteMap, loadFromFileMap, loadSizedAsset } from "@sandmd/assets";
import type { CatalogueSpriteEntry } from "@sandmd/assets";
```

## Quick start

```ts
import { loadSpriteMap } from "@sandmd/assets";

const MOD_ID = "my-mod";

const map = await loadSpriteMap(
  MOD_ID,
  [
    { id: "vase", file: "deco/vase.png" },
    { id: "lamp", file: "deco/lamp.png" },
  ],
  { assetDir: "assets", concurrency: 4 },
);

// -> { vase: "my-mod:vase", lamp: "my-mod:lamp" }
map.vase;
```

## API

### `loadSpriteMap(modId, entries, options?)`

Loads every entry concurrently (pooled, default concurrency `16`) and returns
`Promise<Record<string, string>>` mapping each `entry.id` to the sprite id
`${modId}:${idPrefix ?? ""}${entry.id}`.

| option | default | meaning |
|---|---|---|
| `assetDir` | `""` | folder prefix prepended to each `entry.file` |
| `concurrency` | `16` | how many sprites load at the same time |
| `idPrefix` | `""` | extra prefix inserted into the resulting sprite id |

### `loadFromFileMap(modId, fileMap, options?)`

Shorthand for `loadSpriteMap` when you already have a `{ logicalId: relativePath }`
record instead of an array of `{ id, file }` entries.

### `loadSizedAsset(modId, id, file, assetDir = "assets")`

Loads a **single** sprite under the id `${modId}:${id}` and returns that id.
Convenient for one-off art (a logo, a hero structure).

### Types

- `CatalogueSpriteEntry` — `{ id: string; file: string }`
- `LoadSpriteOptions` — `{ assetDir?; concurrency?; idPrefix? }`

## Example

See [`exemple/main.ts`](./exemple/main.ts) for four worked entry points that
load sprite lists, file maps, prefixed groups, and single assets.
