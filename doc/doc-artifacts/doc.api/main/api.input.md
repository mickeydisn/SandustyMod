> **Entry:** Main only.

# `api.input`

Keyboard bindings and mouse cell/world positions.

---

## Methods

| Method | Parameters | Returns |
|---|---|---|
| `registerBinding` | `(id, keys, meta?)` | `void` |
| `getMousePositionAtCell` / `getMouseCellPosition` | `()` | `{ x, y }` cell |
| `getMousePositionAtWorld` | `()` | `{ x, y }` world px |
| `getBoundKeys` | `(bindingId?)` | keys |
| `getDisplayKey` | `(key)` | display string |
| `triggerBinding` / `pressBinding` / `releaseBinding` | `(id)` | `void` |
| `resetMouseState` | `()` | `void` |
| `isCtrlHeld` / `isAltHeld` | `()` | `boolean` |

### `registerBinding(id, keys, meta?)`

```js
api.input.registerBinding("myMod.toggle", ["KeyO"], {
  nameKey: "mods|myMod|bindings|toggle",
});
```

**Why:** Integrates with the game’s keybind UI and conflict handling. Prefer this over raw `keydown`.

### Mouse

```js
const cell = api.input.getMousePositionAtCell();
const world = api.input.getMousePositionAtWorld();
```

**Note:** For structure click/use, prefer `api.signals.interactables.register`, not mouse polling.
