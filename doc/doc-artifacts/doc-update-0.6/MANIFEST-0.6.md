# modinfo.json — 0.6.0 Relevant Fields

Full formal reference lives at https://sandustry.dev/wiki/modinfo-json-reference.  
This page highlights the fields that matter most for the 0.6 update.

## Required (unchanged)

```json
{
  "manifestVersion": 1,
  "id": "my-mod-id",
  "name": "Display Name",
  "version": "1.0.0",
  "apiVersion": 1
}
```

- `id` must match `^[a-zA-Z0-9_.-]+$`, must not start with `__sandkit`.  
- At least **one** capability is mandatory: `entry`, `workerEntry`, `configOverrides`, `textureOverrides`, `provides`, or `map`.

## Capabilities used by the 0.6 external runtime

### entry / workerEntry

```json
"entry": "entry.js",
"workerEntry": "worker.js"
```

Relative `.js` paths, ≤ 1 MiB each, must stay inside the mod folder.

### textureOverrides

```json
"textureOverrides": {
  "block": "textures/block.png",
  "conveyor_right": {
    "path": "textures/conveyor_anim.png",
    "frameWidth": 16,
    "frames": 4,
    "intervalMs": 120
  }
}
```

See `TEXTURE-OVERRIDES.md`.

### provides (new / first-class in 0.6)

```json
"provides": [
  {
    "kind": "my-skin-kind",
    "id": "variant-a",
    "textureOverrides": { … }
  }
]
```

- 1–32 providers.  
- Player selection stored under `selectedProviders.<kind>`.  
- Combined static + provider overrides ≤ 128.

### configOverrides

```json
"configOverrides": {
  "some.namespace": "config/override.json"
}
```

Each referenced JSON ≤ 256 KiB.

### shaderOverrides (new)

```json
"shaderOverrides": {
  "replaceableShaderId": "precision mediump float; /* … full source … */"
}
```

Only known replaceable shader IDs are accepted. Empty sources are skipped with a diagnostic.

### worldgenEntry (new)

Present in the 0.6 loader. Mods that declare a worldgen entry can participate in procedural / external map generation. Exact shape is still evolving; inspect diagnostics and the external-map discovery path when implementing.

### map

Custom map manifest (blueprints, spawn, bounds, colour mappings). Used for both static custom maps and external map packs.

## Optional metadata (unchanged)

- `description`, `author`  
- `dependencies` (array of manifest ids)  
- `loadOrder` (integer, default 0)  
- `configSchema` (player options; alone does **not** satisfy the capability requirement)

## Limits worth remembering

| Limit | Value |
|---|---|
| modinfo.json size | ≤ 64 KiB |
| Source scripts | ≤ 1 MiB each |
| Texture overrides (static + providers) | ≤ 128 |
| Providers | ≤ 32 |
| Config override files | ≤ 256 KiB each |
| Image assets | ≤ 16 MiB, png/webp/jpg/jpeg |

## Example minimal 0.6-ready mod

```json
{
  "manifestVersion": 1,
  "id": "example-skinpack",
  "name": "Example Skin Pack",
  "version": "1.0.0",
  "apiVersion": 1,
  "provides": [
    {
      "kind": "conveyor",
      "id": "neon",
      "textureOverrides": {
        "conveyor_left":  { "path": "neon/conveyor_l.png", "frameWidth": 16, "frames": 4 },
        "conveyor_right": { "path": "neon/conveyor_r.png", "frameWidth": 16, "frames": 4 }
      }
    }
  ]
}
```