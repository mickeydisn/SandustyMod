> **Entry:** Main only.  
> **Object shapes:** [definitions/api.energy.definition.md](../definitions/api.energy.definition.md)

# `api.energy`

Power networks between structures tagged as conductors or storage.

---

## Methods

| Method | Parameters | Returns |
|---|---|---|
| `registerType` | `(structureId, type, options?)` | `void` |
| `addAtCell` | `(cellX, cellY, amount, options?)` | `void` |
| `consume` | `(amount, options?)` | result / boolean |
| `consumeExcludingNetworkAtCell` | `(cellX, cellY, amount)` | result |
| `getNetworkAtCell` | `(cellX, cellY)` | `NetworkEntry[]` |
| `getNetworkFreeCapacityAtCell` | `(cellX, cellY)` | `number` |

### `registerType(structureId, type, options?)`

```ts
type: "conductor" | "storage"
options?: { priority?: number }
```

**Why:** Marks a structure id as part of the energy graph. Call after `structures.register`.

```js
api.energy.registerType("myMod.battery", "storage", { priority: 5 });
api.energy.registerType("myMod.cable", "conductor");
```

### `getNetworkAtCell(cellX, cellY)`

```ts
entry: { cellX, cellY, type }  // type conductor|storage
```

```js
for (const entry of api.energy.getNetworkAtCell(cx, cy)) {
  // entry.cellX, entry.cellY, entry.type
}
```

### `addAtCell` / `consume`

Inject or draw energy. `consume` may support all-or-nothing style options depending on version.

**When:** Production ticks, tool use, machine process callbacks.
