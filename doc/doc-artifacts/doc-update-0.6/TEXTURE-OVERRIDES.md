# Texture Overrides & Providers (0.6.0)

Implementation source: `external-mod-runtime.0.6.0.js` (`applyExternalTextureOverrides`).

## Two ways to override

### 1. Static path (string)

```json
"textureOverrides": {
  "light": "textures/my_light.png"
}
```

### 2. Animation descriptor (object)

```json
"textureOverrides": {
  "conveyor_right": {
    "path": "textures/conveyor_anim.png",
    "frameWidth": 16,
    "frames": 4,
    "intervalMs": 120
  }
}
```

- `path` — relative to the mod root.  
- `frameWidth` — **must** match the hard-coded value for that texture id (see table below).  
- `frames` — number of frames in the horizontal strip.  
- `intervalMs` — optional; defaults to **166**.  

The loaded image must satisfy:

```
width  === frameWidth × frames
height === originalHeight
```

Otherwise the override is rejected with `texture_override_incompatible_dimensions`.

## Hard-coded animated targets (frameWidth)

These are the only textures that currently accept a declarative animation layout.  
Any other texture that receives an object instead of a string will produce `texture_override_unsupported_animation_layout`.

| Texture id            | Required frameWidth |
|-----------------------|---------------------|
| `block`               | 16                  |
| `triangle_right`      | 16                  |
| `triangle_right_del`  | 16                  |
| `triangle_left`       | 16                  |
| `triangle_left_del`   | 16                  |
| `conveyor_left`       | 16                  |
| `conveyor_right`      | 16                  |
| `filter_left`         | 18                  |
| `filter_right`        | 18                  |
| `farm`                | 18                  |
| `gloom_emitter`       | 16                  |
| `pump`                | 16                  |
| `liquid_vent`         | 16                  |
| `light`               | 16                  |
| `shaker_left`         | 18                  |
| `shaker_right`        | 18                  |
| `velocity`            | 18                  |

## Rules enforced by the runtime

1. Target must exist in the game’s built-in `images` map → otherwise `texture_override_unknown_target`.  
2. Target must **not** contain gameplay `imageData` → otherwise `texture_override_gameplay_asset`.  
3. Dimensions must match (static or animated) → `texture_override_incompatible_dimensions`.  
4. Animation layout only allowed for the table above with the exact `frameWidth` → otherwise `texture_override_unsupported_animation_layout`.  
5. Load failure → `texture_override_load_failed` (includes the underlying cause).  

Successful animated overrides are collected into an `animationLayouts` array that the game later installs via `installBuiltInTextureAnimationLayouts`.

## Selectable providers (`provides`)

```json
"provides": [
  {
    "kind": "conveyor-skin",
    "id": "cyber",
    "textureOverrides": {
      "conveyor_left":  { "path": "cyber/l.png", "frameWidth": 16, "frames": 4 },
      "conveyor_right": { "path": "cyber/r.png", "frameWidth": 16, "frames": 4 }
    }
  }
]
```

- Multiple mods can contribute providers for the same `kind`.  
- The player chooses one provider per kind; the choice is persisted as `selectedProviders.<kind> = <providerId>`.  
- If a previously selected provider is no longer installed, the runtime emits `asset_provider_selection_missing` and simply applies no provider for that kind.  
- Provider overrides are applied **after** static `textureOverrides` and share the same validation rules.

## Runtime API (main thread)

```js
// Discover
const providers = sandkit.api.mods.getProviders("conveyor-skin");

// Read / write selection
const current = sandkit.api.assets.getSelectedProvider("conveyor-skin");
sandkit.api.assets.setSelectedProvider("conveyor-skin", "cyber");
// alias: assets.selectProvider
```

## Practical tips

- Prefer a single horizontal strip PNG for animated overrides.  
- Keep frame counts modest; the engine still renders them as ordinary sprites.  
- Always ship a fallback static version if you also want the texture to work when the player has not selected your provider.  
- Test dimension mismatches early — the diagnostic message already contains the expected vs actual size.