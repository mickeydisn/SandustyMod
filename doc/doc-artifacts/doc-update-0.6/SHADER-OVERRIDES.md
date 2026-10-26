# Shader Overrides (0.6.0)

Present in the 0.6.0 loader path that processes external mods.

## Manifest field

```json
"shaderOverrides": {
  "knownReplaceableShaderId": "precision mediump float;\n/* full GLSL source */"
}
```

- Keys must be **known replaceable shader IDs**.  
- Values must be non-empty strings (the GLSL source).  
- Applied early, before most content registration.

## Diagnostics produced by the loader

| Code | Meaning |
|---|---|
| `shader_override_unknown_target` | The shader ID is not in the replaceable set; override skipped. |
| `shader_override_empty` | Source is missing or empty; override skipped. |

Both diagnostics include `modId`, `field` (e.g. `shaderOverrides.<id>`), and Workshop metadata when applicable.

## Related runtime API (main thread only)

The rendering namespace exposes first-class shader support that pairs well with overrides:

```js
// Register a completely new shader program
sandkit.api.rendering.shaders.register({
  id: "myMod.glow",
  // source + default uniforms …
});

// Spawn a world-space effect that uses a registered shader
sandkit.api.rendering.worldShaderEffects.createAtWorld(
  "myMod:glow-fx",
  worldX,
  worldY,
  { /* shader, size, blend … */ }
);

// Drive uniforms per frame
sandkit.api.rendering.worldShaderEffects.setUniform("myMod:glow-fx", "uTime", t);
```

Also available: player mirrors, position updates, removal helpers.

## When to use `shaderOverrides` vs `patches.json`

| Approach | Prefer when… |
|---|---|
| `shaderOverrides` | The shader ID is listed as replaceable and you only need to swap the source. |
| `patches.json` | You need to alter surrounding JS logic or a non-replaceable shader. |

`shaderOverrides` is safer across game updates because it does not rely on string matching inside the minified bundle.

## Limits & safety

- Only replaceable IDs are accepted; unknown IDs are ignored with a diagnostic.  
- Empty sources are ignored.  
- The override is scoped to the mod that declared it; later mods can also override the same ID (order follows normal load-order rules).