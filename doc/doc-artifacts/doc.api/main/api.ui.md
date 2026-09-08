> **Entry:** Main full / Worker **`toast` only**.

# `api.ui`

## Worker

```ts
api.ui.toast(message | options) → void
```

## Main (selection)

| Method | Role |
|---|---|
| `toast` | Brief message |
| `alert` / `confirm` / `prompt` / `select` | Modal dialogs |
| `showTooltip` | Tooltip |
| `openPauseMenu` | Pause UI |
| `overlays.register(slot, id, render)` | Overlay mount |
| `overlays.unregister` | Remove overlay |
| React helpers | `useGameEvent`, `useHotbar`, `useScale`, components |

```js
api.ui.toast({ key: "mods|myMod|toast|ok" });
const ok = await api.ui.confirm("Destroy?", "Confirm");
```
