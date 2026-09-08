> **Entry:** Main + Worker — methods differ (see table).  
> Official: [sandkit.html](https://sandustry.com/sandkit.html)  
> **Object shapes:** [definitions/api.structures.definition.md](../definitions/api.structures.definition.md)

# `api.structures`

Structures are multi-cell buildings placed on the grid. **Register and build on Main.** Query and update instance data on **both** entries.

`state` is injected by the runtime — do **not** pass it from mod code.

---

## Availability matrix

| Method | Main | Worker | Returns |
|---|:---:|:---:|---|
| `register(definition, options?)` | ✓ | — | `void` |
| `updateDefinition(typeOrId, partial, options?)` | ✓ | — | `void` |
| `registerVariant(base, variant, options?)` | ✓ | — | `void` |
| `registerPlacementConfig(definition)` | ✓ | — | `void` |
| `recipes.register(id, definition)` | ✓ | — | `void` |
| `processing.register(id, definition)` | ✓ | — | `void` |
| `getAtCell(cellX, cellY)` | ✓ | ✓ | `Structure \| null` |
| `getDefinitionByType(type)` | ✓ | ✓ | `StructureConfig \| undefined` |
| `getTypeById(id)` / `getTypeFromId(id)` | ✓ | ✓ | `number \| type` |
| `getAvailableTypes()` | ✓ | — | `type[]` |
| `hasBuiltAtCell(cellX, cellY)` | ✓ | ✓ | `boolean` |
| `isType(structure, id)` | ✓ | ✓ | `boolean` |
| `isTypeAtCell(cellX, cellY, id)` | ✓ | ✓ | `boolean` |
| `isBlockedByPlayerAtCell(cellX, cellY)` | ✓ | — | `boolean` |
| `isLauncherAtCell(cellX, cellY)` | ✓ | — | `boolean` |
| `isLockedByType(type)` | ✓ | — | `boolean` |
| `forEachOfType(typeOrId, callback)` | ✓ | ✓ | `void` |
| `update(structure, options?)` | ✓ | ✓ | `void` |
| `updateData(structure, partial, options?)` | ✓ | ✓ | `void` |
| `setSpritesheetIndex(structure, index)` | ✓ | ✓ | `void` |
| `setSpritesheetIndexAtCell(cx, cy, index)` | ✓ | ✓ | `void` |
| `setSpritesheetIndexByValue(structure, value, thresholds)` | ✓ | ✓ | `void` |
| `setSpritesheetIndexByValueAtCell(cx, cy, value, thresholds)` | ✓ | ✓ | `void` |
| `mapValueToSpritesheetIndex(value, thresholds)` | ✓ | — | `number` |
| `buildAtCell(cx, cy, typeOrId, options?)` | ✓ | — | `void` |
| `removeAtCell(cx, cy, options?)` | ✓ | — | `void` |
| `removeBetweenCells(...)` / `removeAtCells(positions, options?)` | ✓ | — | `void` |
| `processing.isEnabledAtCell(cx, cy)` | ✓ | ✓ | `boolean` |
| `processing.setEnabledAtCell(cx, cy, enabled)` | ✓ | limited | `void` |

---

## Registration (Main only)

### `register(definition, options?)`

**Why:** Declares a new placeable structure type for the game (build menu, blueprints, sim).

**When:** Call during mod init on **Main** (`manifest.entry`), after sprites are loaded if you use custom art.

```ts
function register(definition: StructureDefinition, options?: RegisterOptions): void
```

See full `StructureDefinition` in [definitions/api.structures.definition.md](../definitions/api.structures.definition.md).

```js
api.structures.register({
  id: "myMod.junction",
  nameKey: "mods|myMod|structures|junction|name",
  categoryKey: "logistics",
  buildModes: [{ type: "line", directions: ["horizontal", "vertical"], spanTiles: 4 }],
  shape: [[1]],
  defaultData: { channel: 1 },
  render: { imageName: "myMod.junction", size: { width: 16, height: 16 } },
});
```

Then unlock for the player:

```js
api.player.buildings.unlockById("myMod.junction");
```

### `updateDefinition(structureTypeOrId, partial, options?)`

Patches an existing type (vanilla or mod). Use to change `buildModes`, tooltips, etc. without full re-register.

### `registerVariant(baseStructureTypeOrId, variant, options?)`

Adds a rotated/alternate variant. `options.addBuildMode` can attach an extra build mode.

---

## Queries (Main + Worker)

### `getAtCell(cellX: number, cellY: number): Structure | null`

Returns the structure instance occupying that cell, or `null`.

```js
const s = api.structures.getAtCell(cx, cy);
if (s) console.log(s.type, s.x, s.y, s.data);
```

**Structure instance (typical fields):** `type`, `x`, `y`, `data`, optionally `queued`, `id`, size-related fields.

### `isType(structure, structureId): boolean`  
### `isTypeAtCell(cellX, cellY, structureId): boolean`

Type checks. Prefer these over comparing raw type numbers.

### `forEachOfType(structureTypeOrId, callback: (structure) => void): void`

Iterates all placed instances of a type. Useful for global updates (sensors, production).

```js
api.structures.forEachOfType("myMod.sensor", (structure) => {
  api.signals.setOutputAtCell(structure.x, structure.y, structure.data.active);
});
```

### `getDefinitionByType(type)` / `getTypeById(id)`

Config lookup and id→type resolution. Worker resolves names via engine `getConfig` / type maps.

---

## Mutating instances (Main + Worker)

### `updateData(structure, partial, options?): void`

**Preferred** over deprecated `setData`. Merges `partial` into `structure.data`.

```ts
options?: { propagateToWorkers?: boolean }
```

```js
api.structures.updateData(structure, { mode: "allow", channel: 3 }, {
  propagateToWorkers: true,
});
```

**Why `propagateToWorkers`:** Instance data lives on main; set true when workers must see the change immediately for sim logic.

### `update(structure, options?): void`

Pushes the whole structure record (after you mutated `structure.data` yourself).

### Spritesheet

```ts
setSpritesheetIndex(structure, index: number): void
setSpritesheetIndexAtCell(cellX, cellY, index: number): void
setSpritesheetIndexByValue(structure, value: number, thresholds: number[]): void
setSpritesheetIndexByValueAtCell(cellX, cellY, value: number, thresholds: number[]): void
mapValueToSpritesheetIndex(value: number, thresholds: number[]): number  // Main
```

`thresholds` example `[0, 25, 50, 75]` maps value ranges → frame index 0..n.

**How:** Call after changing state so the rendered frame matches `data`.

---

## Build / remove (Main only)

```ts
buildAtCell(cellX, cellY, structureTypeOrId, options?): void
removeAtCell(cellX, cellY, options?): void
removeBetweenCells(x1, y1, x2, y2, options?): void
removeAtCells(positions: {x,y}[], options?): void
```

`*WhenIdle` names are deprecated aliases for deferred main path.

---

## Processing

Register on **Main**:

```js
api.structures.processing.register("myMod.machine:tick", {
  structureType: "myMod.machine",
  intervalMs: 250,
  process: (structure, context) => {
    if (!context.isCellEmptyAtCell(structure.x, structure.y - 1)) return;
    // … produce element, etc.
  },
});
```

`context` helpers: `isCellEmptyAtCell`, `getResolvedTypeAtCell`, `commit`, `isEnabledAtCell`, `setEnabledAtCell` (set is main-oriented).

Worker can **read** `processing.isEnabledAtCell(cx, cy)`.

---

## Recipes

```js
api.structures.recipes.register("kineticPress", {
  input: "sand",
  outputs: [{ elementType: "compressedSand", chance: 1 }],
  minimumDownwardVelocityCellsPerSecond: 20,
});
```

---

## Execution notes

1. **Register order:** `sprites.load` → `structures.register` → `player.buildings.unlockById` → optional `processing.register` / signals.  
2. **Worker** cannot register types; it only sees types already registered on main.  
3. Clicks: use `api.signals.interactables.register` (Main), not mouse polling.  
4. Always prefer official names: `updateData`, `*AtCell`, `unlockById`.
