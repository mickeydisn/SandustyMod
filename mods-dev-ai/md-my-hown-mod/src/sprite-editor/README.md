# sprite-editor (for md-my-hown-mod)

An in-game pixel editor: **one sprite at a time, every tool of the Grid Editor**, saved as base64
PNG inside the mod's JSON config and registered as a game sprite.

## Install (2 steps)

1. Copy this folder to `src/sprite-editor/`.
2. From the mod root (`mods-dev-ai/md-my-hown-mod`): `git apply sprite-editor-integration.patch` (or
   `patch -p1 < sprite-editor-integration.patch`)

The patch touches only two existing files (+13 / −4 lines):

- `src/ui/panel.ts` – adds the **draw** tab (import, `Tab` type, tab list, one render branch).
- `src/packages/mysandkit.ts` – `registerSprite` hands `data:` sources to the editor's registrar.

Nothing else changes: no new storage key, no change to `constants.ts`, `config/store.ts`,
`apply.ts`.

## How it is stored

A drawn sprite is a normal entry of the existing `sprites` category, so it is exported/imported by
the JSON tab, wiped by the disable-cleanup, and registered by `applyConfig()` at boot:

```json
{
    "id": "md-my-hown-mod:crate",
    "kind": "drawn",
    "fromMod": false,
    "source": "data:image/png;base64,iVBORw0KGgo…",
    "width": 32,
    "height": 16,
    "frameWidth": 16,
    "frames": 2,
    "updatedAt": 1767225600000
}
```

Use the id anywhere a sprite id is expected (`items[].sprite.id`, `structures[].render.imageName`,
projectiles…). `frames = width / 16`: add tiles (tool 6) to build spritesheet frames.

## Draw tab

- lists drawn sprites (thumbnail, size, frames) → **Edit / ⧉ duplicate / Del** (Del asks twice)
- **+ New sprite** (name + size), **Import PNG…**
- **Existing asset collection**: file-based `sprites` entries (`path`) → _Edit_ loads the PNG;
  saving under the same id converts that entry into an editable drawn sprite (old path kept as
  `replacedPath`)
- **Load any file from the mod folder** (`api.assets.getUrl(path)`)

## Editor

`1` Pencil · `2` Eraser · `3` Fill · `4` Picker · `5` Pan · `6` Add tile · `7` Remove tile · `8`
Square (filled / lock 1:1) · `9` Copy tile (drag tile → tile, `Esc` cancels) · `Ctrl+Z` undo (60) ·
`Ctrl+S` save · scroll = pan · `Shift`/`Ctrl`+scroll = zoom · `Space`/`Shift`+drag = pan · `+ − 0`
zoom/fit · palette: click = pick, double-click = recolor, drag swatch onto another = merge · Export
PNG.

Keys typed in the editor never reach the game. The open sprite (pixels + undo + view) survives
closing the overlay, switching tabs or minimising the panel; closing with unsaved changes asks Save
/ Discard.

## Files

| file                     | role                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `engine.ts`              | pure pixel logic (no DOM) – unit-testable                                 |
| `codec.ts`               | PNG ⇄ base64, image loading (mod assets / files)                          |
| `store.ts`               | CRUD on `config.sprites`, id rules, save = validate → JSON → register     |
| `register.ts`            | `sprites.load(id, dataUrl)` → fallback blob URL → verified with `getById` |
| `editor.ts` / `theme.ts` | the editor window                                                         |
| `tab.ts`                 | the draw tab (list + host of the editor)                                  |
| `index.ts`               | public exports (`getDrawTab`, `listSpriteOptions`, …)                     |

## Optional: sprite picker in forms

`listSpriteOptions()` returns `{value,label}[]` (drawn first). To use it in `catalog.ts`, replace
`{ key: "spriteId", label: "Sprite id", type: "text" … }` by
`{ key: "spriteId", label: "Sprite id", type: "select", options: listSpriteOptions }` (import from
`./sprite-editor/index.ts`). Not applied by default because it removes free-text ids (vanilla
sprites).

## Known unknowns (need one in-game check)

`api.sprites.load` is documented for paths. Data/blob URLs are tried automatically and verified with
`getById`; if neither works the sprite is still saved and the panel says so. Whether re-saving an
existing id replaces a cached texture in the running game (vs. needing a restart) is also untested.
