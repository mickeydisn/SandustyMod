> **Entry:** Main + Worker — methods differ.  
> Official: [sandkit.html](https://sandustry.com/sandkit.html)  
> **Object shapes:** [definitions/api.elements.definition.md](../definitions/api.elements.definition.md)

# `api.elements`

Simulated matter in grid cells (sand, water, steam, …).

**Main:** cell writes are **deferred** (reads may see old values until flush).  
**Worker:** cell writes are **immediate**.  
For read+write on Main use `api.grid.mutate`.

---

## Availability matrix

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `register(definition)` | ✓ | — | `void` |
| `updateDefinition(typeOrId, partial)` | ✓ | — | `void` |
| `getRegisteredTypes()` | ✓ | — | `type[]` |
| `addInteractionInfo(typeOrId, interaction)` | ✓ | — | `void` |
| `getTypeById(id)` / `getIdByType(type)` | ✓ | ✓ | type / id |
| `getDefinitionByType(type)` | ✓ | ✓ | config |
| `getNameByType(type)` | ✓ | — | `string` |
| `getTypeAtCell(cx, cy)` | ✓ | ✓ | type \| null |
| `getResolvedTypeAtCell(cx, cy)` | ✓ | ✓ | type \| null |
| `getResolvedTypeFromCellId(cellId)` | ✓ | ✓ | type \| null |
| `getInfoAtCell(cx, cy)` | ✓ | ✓ | info object |
| `getMatterTypeAtCell(cx, cy)` | ✓ | ✓ | matter enum |
| `isTypeAtCell(cx, cy, typeOrId)` | ✓ | ✓ | `boolean` |
| `isFreeFallingAtCell(cx, cy)` | ✓ | ✓ | `boolean` |
| `findFreeCellInStructure(...)` | ✓ | — | cell \| null |
| `createAtCell(cx, cy, typeOrId, options?)` | ✓ | ✓ | `void` |
| `replaceAtCell(cx, cy, typeOrId, options?)` | ✓ | ✓ | `void` |
| `removeAtCell(cx, cy, options?)` | ✓ | ✓ | `void` |
| `teleportBetweenCells(...)` | ✓ | ✓ | `void` |
| `moveBetweenCells(...)` | — | ✓ | result |
| `swapBetweenCells(...)` | — | ✓ | result |
| `getVelocityAtCell` / `setVelocityAtCell` | ✓ | ✓ | vel \| null / void |
| `addParticleVelocityAtCell` | ✓ | ✓ | `void` |
| `convertToParticleAtCell` / `convertFromParticleAtCell` | ✓ | ✓ | `void` |
| `getDataFieldAtCell` / `setDataFieldAtCell` | ✓ | ✓ | value \| null / bool |
| `setDurationAtCell(cx, cy, ticks, options?)` | ✓ | ✓ | bool/result |
| `setPhysicsAtCell(cx, cy, physics)` | ✓ | ✓ | `void` |
| `refreshColorAtCell(cx, cy)` | ✓ | ✓ | `void` |
| `markMovementBlockedByIndex(index)` | — | ✓ | `void` |

---

## Registration (Main only)

```ts
api.elements.register(definition: ElementDefinition): void
```

```js
api.elements.register({
  id: "myMod.slime",
  nameKey: "mods|myMod|elements|slime|name",
  density: 150,
  isTransportable: true,
  collectable: false,
  // matterType: sandkit.enums… 
});
```

**Why Main only:** Type tables and UI pickers live on the main runtime. Worker only resolves already-known types via `getTypeById`.

---

## Cell writes

### `createAtCell(cellX, cellY, elementTypeOrId, options?): void`

Worker implementation only creates if `world.isCellEmpty`; otherwise no-op.

```ts
options?: { durationTicks?: number }  // alias: duration
```

```js
api.elements.createAtCell(cx, cy, "water", { durationTicks: 60 });
```

### `replaceAtCell` / `removeAtCell`

Replace ignores empty checks differently than create. Remove no-ops if no resolved element at cell (worker).

### Velocity

```js
api.elements.setVelocityAtCell(cx, cy, { x: 0, y: -120 });
api.elements.addParticleVelocityAtCell(cx, cy, { x: 4, y: -8 }, /* maxSpeed */ 120);
```

Units match official examples (large numbers ≈ pixels/sec style engine units).

### Physics

```js
api.elements.setPhysicsAtCell(cx, cy, api.constants.physics.skip);
// normal=0, skip=1, aggressiveSkip=2
```

Worker also reports chunk activity after physics change.

### Duration

```js
api.elements.setDurationAtCell(cx, cy, 120, { updateMax: true });
```

Returns falsy if no element at cell (worker).

---

## Main-safe read + write

```js
const water = api.elements.getTypeById("water");
api.grid.mutate((writer) => {
  if (!api.terrains.isTypeAtCell(cx, cy, "ice")) return;
  writer.elements.replaceAtCell(cx, cy, water);
});
```

---

## Execution notes

1. Prefer string ids (`"water"`) when official examples do; resolve with `getTypeById` when you need numeric types.  
2. Worker `createAtCell` silently skips non-empty cells.  
3. `*WhenIdle` aliases = deferred main variants; prefer `grid.mutate` for correctness.  
4. Transport/collect flags on the definition control conveyor and collector behavior.
