> **Entry:** by sub-API.  
> **Options:** [definitions/api.lights.definition.md](../definitions/api.lights.definition.md)

# `api.lights`

## temporary (Main + Worker)

```ts
createAtWorld(worldX, worldY, options?) → { lightId, index }
removeById(lightId) → void
```

```js
const light = api.lights.temporary.createAtWorld(wx, wy, {
  durationMs: 250,
  brightness: 1.5,
  size: 80,
  color: [1, 0.8, 0.3, 1],
});
```

Worker facade maps `durationTicks` → internal `duration`.

## persistent (Main only)

```ts
createAtWorld(wx, wy, options?)
removeAtWorld(wx, wy)
fadeAtWorld(wx, wy, durationMs?)
markDirty()
```

## vfx (Main + Worker)

`createAtWorld` (Main also `removeById`).
