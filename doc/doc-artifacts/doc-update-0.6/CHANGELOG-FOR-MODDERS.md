# What’s New for Modders in Sandustry 0.6.0

Derived from `bundle.0.6.0.js` + `external-mod-runtime.0.6.0.js` and cross-checked with the public Steam patch notes.

## 1. Texture system overhaul (most visible change)

### Declarative animation for texture overrides

Previously texture overrides were mostly static image replacements.  
0.6.0 adds first-class **animation descriptors**:

```json
"textureOverrides": {
  "conveyor_right": {
    "path": "textures/my_conveyor.png",
    "frameWidth": 16,
    "frames": 4,
    "intervalMs": 120
  }
}
```

- Supported animated targets and their **required** `frameWidth` are hard-coded in the runtime (see `TEXTURE-OVERRIDES.md`).  
- `intervalMs` defaults to **166** ms if omitted.  
- Dimension check is now strict: width must equal `frameWidth × frames`, height must match the original asset height.  
- Gameplay textures that contain `imageData` still cannot be replaced.

### Selectable asset providers (`provides`)

Mods can now register **competing texture packs**:

```json
"provides": [
  {
    "kind": "conveyor-skin",
    "id": "neon",
    "textureOverrides": { … }
  }
]
```

- Player selects one provider per `kind` (stored as `selectedProviders`).  
- Static `textureOverrides` + all selected providers together may not exceed **128** overrides.  
- Missing selected providers produce a diagnostic but do not crash the load.  
- Runtime API: `sandkit.api.assets.getSelectedProvider(kind)`, `setSelectedProvider` / `selectProvider`, `sandkit.api.mods.getProviders(kind)`.

## 2. Shader overrides

New top-level manifest field `shaderOverrides`:

```json
"shaderOverrides": {
  "someShaderId": "/* full GLSL source */"
}
```

- Only shader IDs that the engine marks as **replaceable** are accepted.  
- Empty / non-string sources are rejected with a diagnostic.  
- Applied early, before most content registration.  
- Related runtime API (main thread): `sandkit.api.rendering.shaders.register`, world shader effects, uniforms, player mirrors.

## 3. Worldgen / external map entry

New capability `worldgenEntry` (and expanded external-map loading path):

- Mods can supply procedural or custom map generation.  
- External map discovery + blueprints (terrain, lights, sensors, authorization, wall, foliage, cracks, prefab placements, colour mappings) are first-class.  
- Procgen progress UI, lore text, and optional “show / save generated map” debug paths exist in the loader.

## 4. Content registration surface (expanded)

The simulation still receives dedicated messages:

- `RegisterModMatters`
- `RegisterModElements`
- `RegisterModTerrains`
- `RegisterModStructures`
- `RegisterModRecipes`
- `RegisterModSharedBuffer`

**Public sandkit surface (authoritative):** see **`SANDKIT-NAMESPACES-0.6.md`** — full list of the 65 namespaces from https://sandustry.dev/api (v0.6.0), plus known aliases / preferred method names (`getPositionAtWorld` vs older `getWorldPosition`, `tech.registerDefinition` ≡ `tech.addDefinition`, `…WhenIdle` vs worker `…AtCell`, etc.).

> Note: `decorOverrides` appears in the 0.6 bundle but is an **internal** prefab-decor path (`prefabDecor`), not a public modinfo field and not a sandkit namespace.

Worker entries continue to receive a restricted, simulation-focused subset (official wiki marks worker-available namespaces).

## 5. Lifecycle events of interest

| Event | Typical use |
|---|---|
| `mods:initialized` | All external mods loaded, diagnostics collected |
| `game:ready` | Safe to register UI, spawn content, toast |
| `game:started` | Simulation loop running |

See `EVENTS-AND-HOOKS.md`.

## 6. UI / React improvements (from patch notes)

The 0.6 UI overhaul introduced a more consistent component library.  
The stated goal is easier custom panels for modders.  
`sandkit.react` remains available; prefer the official wiki examples once they are refreshed.

## 7. Diagnostics & safety

The external-mod runtime now emits structured diagnostics for:

- unknown texture targets  
- gameplay assets that cannot be overridden  
- dimension mismatches  
- unsupported animation layouts  
- load failures  
- missing selected providers  
- unknown / empty shader overrides  

See `RUNTIME-DIAGNOSTICS.md` for the exact codes.

## Migration checklist for existing mods

1. Re-test every `textureOverrides` entry — dimensions and animation metadata are now validated strictly.  
2. If you ship multiple skins, migrate to `provides` so the player can choose.  
3. If you previously patched shaders with `patches.json`, prefer `shaderOverrides` when the target is replaceable.  
4. Listen for `game:ready` / `mods:initialized` instead of ad-hoc timeouts.  
5. Confirm your mod still declares at least one capability (`entry`, `workerEntry`, `configOverrides`, `textureOverrides`, `provides`, or `map`).  
6. Keep `apiVersion: 1`.