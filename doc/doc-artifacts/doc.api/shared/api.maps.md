> **Entry:** Main + Worker — methods differ.

# `api.maps`

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `getActive()` | ✓ | ✓ | active map id/info |
| `getAvailable()` | ✓ | — | list |
| `start(mapId)` | ✓ | — | `void` (MainMenu only) |
| `getArtifactLocations()` | ✓ | — | locations |
| `addMarker(...)` | ✓ | — | `void` |

```js
if (api.scene.getActive() === /* MainMenu */) {
  api.maps.start("myMod.mapId");
}
```
