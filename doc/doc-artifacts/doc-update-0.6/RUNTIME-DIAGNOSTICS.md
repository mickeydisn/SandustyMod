# Runtime Diagnostics (0.6.0)

All diagnostics share a common shape (extra fields appear depending on the code):

```ts
{
  code: string;
  message: string;
  modId?: string;
  field?: string;
  textureId?: string;
  providerId?: string;
  providerKind?: string;
  workshop?: unknown;
  cause?: unknown;
}
```

## Texture / provider diagnostics

| Code | Trigger |
|---|---|
| `texture_override_unknown_target` | Texture id not present in the built-in image map |
| `texture_override_gameplay_asset` | Target contains gameplay `imageData` and cannot be replaced |
| `texture_override_incompatible_dimensions` | Loaded image size ≠ expected (static or `frameWidth×frames`) |
| `texture_override_unsupported_animation_layout` | Object supplied for a non-animated target, or wrong `frameWidth` |
| `texture_override_load_failed` | Network / decode / path error (includes `cause`) |
| `asset_provider_selection_missing` | Saved `selectedProviders.<kind>` points at a provider that is no longer installed |

## Shader diagnostics

| Code | Trigger |
|---|---|
| `shader_override_unknown_target` | Shader id is not in the replaceable set |
| `shader_override_empty` | Source string is empty or missing |

## Config / general diagnostics

Config overrides and other manifest problems produce additional codes (namespace / path validation, missing files, size limits, etc.). The exact set grows with the official docs; always log the full diagnostic object during development.

## How diagnostics surface

- Collected into the mod-loading result object.  
- Visible in the in-game Mods UI / loading log.  
- Non-fatal in almost all cases — the offending override is simply skipped so the rest of the mod (and other mods) can continue loading.

## Best practice

During development, always inspect the diagnostics array after a load. A single dimension mismatch or wrong `frameWidth` is enough to silently drop an entire skin pack.