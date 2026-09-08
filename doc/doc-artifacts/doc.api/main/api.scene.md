> **Entry:** Main only.

# `api.scene`

## Methods

### `getActive(): Scene | string`

**Returns:** the active scene identifier (`sandkit.enums.Scene`).

**Typical values:** main menu vs in-game (exact enum members in `sandkit.enums.Scene`).

```js
const scene = api.scene.getActive();
// Only start custom maps from the menu:
// if (scene === MainMenu) api.maps.start("myMod.map");
```

**Why:** Gate menu-only APIs (`api.maps.start`, some UI flows).
