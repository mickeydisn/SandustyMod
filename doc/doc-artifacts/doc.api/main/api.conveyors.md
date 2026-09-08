# Sandustry API — `api.conveyors`

> **Entry:** Main only (`manifest.entry`). Official: [sandkit.html](https://sandustry.com/sandkit.html).


Register structure types as conveyors so the transport sim moves elements on them.

---

## Surface

```ts
api.conveyors.registerType(structureType, options?)
```

---

## `registerType(structureType, options?)`

```ts
structureType: string | number   // structure type id (must be a registered structure)
options?: any                    // forwarded to workers via RegisterConveyorType
```

### Behaviour

1. On **main** (non-worker): marks the structure type index as a conveyor in the block-grid tables (`markConveyorTypeIndex`).
2. If multithreading simulation is active: `postAll` → `RegisterConveyorType` with `(structureType, options)` so all sim workers know the type.

Call **after** `api.structures.register(...)`.

---

## Example

```js
api.structures.register({
  id: "myMod.belt",
  shape: [[1, 1, 1]],
  buildModes: [{ type: "line", directions: ["horizontal"] }],
  categoryKey: "logistics"
});

api.conveyors.registerType("myMod.belt", {
  // engine-specific transport options if any
});
```

---

## Notes

- Direction / speed behaviour is largely driven by structure type + shape / variants (like vanilla left/right conveyors).
- Pair with structure variants for left/right/up orientations.
- Related: `api.launchers` for launcher belts, `api.structures.isLauncherAt`.
