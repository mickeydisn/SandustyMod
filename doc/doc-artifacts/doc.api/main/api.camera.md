> **Entry:** Main only.

# `api.camera`

## Methods

### `snapToPlayer(): void`
Instantly centers camera on the player.

### `setFocusAtWorld(worldX, worldY): void`

| Param | Type | Description |
|---|---|---|
| `worldX` | `number` | World pixel X |
| `worldY` | `number` | World pixel Y |

Locks/focuses camera on a world point (cutscenes, markers).

### `releaseFocus(options?): result`

| Param | Type | Description |
|---|---|---|
| `options.durationMs` | `number` optional | Smooth release duration |

```js
api.camera.setFocusAtWorld(wx, wy);
api.camera.releaseFocus({ durationMs: 250 });
```
