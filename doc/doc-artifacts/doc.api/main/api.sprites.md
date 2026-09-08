> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.sprites`

Sprite loading for items, structures, projectiles.

## Methods

### `load(spriteId, path, options?): Promise`
Loads a sprite by absolute/game path.

| Param | Type | Description |
|---|---|---|
| `spriteId` | `string` | Id referenced by items/structures |
| `path` | `string` | Asset path |
| `options` | `object` optional | Frame size, etc. if supported |

### `loadFromMod(spriteId, relativePath, options?): Promise`
Loads from the **current mod** root.

| Param | Type | Description |
|---|---|---|
| `spriteId` | `string` | Id to register |
| `relativePath` | `string` | Path relative to mod (e.g. `assets/icon.png`) |

### `getById(spriteId): Sprite | null`
Returns loaded sprite handle.

### `hideAllForPlayer(): void`
Alias: `hideAllPlayerModSprites`. Hides player-attached mod sprites.

### `rotateAllForPlayer(angleRadians): void`
Alias: `rotatePlayerModSprites`.

```js
await api.sprites.loadFromMod("myMod.tool", "assets/tool.png");
api.items.register({ id: "myMod.tool", sprite: { id: "myMod.tool" } });
```

**Order:** always `load` / `loadFromMod` **before** `items.register` or structure `render.imageName` use.
