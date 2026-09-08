# Element definition & cell options

Parent: [../shared/api.elements.md](../shared/api.elements.md)  
Official: [sandkit.html](https://sandustry.com/sandkit.html)

---

## `register(definition)` — Main only

| Field | Type | Default / notes |
|---|---|---|
| `id` | `string` | **Required** unique id |
| `name` | `string` | Display fallback |
| `nameKey` | `string` | i18n name |
| `descriptionKey` | `string` | i18n description |
| `matterType` | enum/number | Solid / Liquid / Gas / Powder / … (`sandkit.enums`) |
| `density` | `number` | Sim density |
| `isTransportable` | `boolean` | Default true in engine templates — conveyors/launchers |
| `collectable` | `boolean` | Collector value path |
| `visibleInPicker` | `boolean` | UI picker visibility |
| `showInFilterPicker` | `boolean` | Filter UI (`updateDefinition` example) |
| `color` | number or array | Render color |
| `duration` | `number` | Default lifetime ticks if ephemeral |

```js
api.elements.register({
  id: "myMod.slime",
  nameKey: "mods|myMod|elements|slime|name",
  density: 150,
  isTransportable: true,
  collectable: false,
});

api.elements.updateDefinition("myMod.slime", {
  showInFilterPicker: false,
});
```

### `addInteractionInfo(elementTypeOrId, interaction)`
Attaches tooltip/interaction metadata (Main).

---

## Cell write `options`

Used by `createAtCell`, `replaceAtCell`, and related methods.

| Field | Type | Description |
|---|---|---|
| `durationTicks` | `number` | Lifetime in ticks (**preferred**) |
| `duration` | `number` | **Deprecated alias** of `durationTicks` |

```js
api.elements.createAtCell(cx, cy, "steam", { durationTicks: 120 });
```

## Velocity argument

| Field | Type | Description |
|---|---|---|
| `x` | `number` | Horizontal component |
| `y` | `number` | Vertical (negative = up in official examples) |

```js
api.elements.setVelocityAtCell(cx, cy, { x: 0, y: -120 });
api.elements.addParticleVelocityAtCell(cx, cy, { x: 4, y: -8 }, 120);
// last arg: maxSpeedCellsPerSecond optional
```

## `setDurationAtCell(cx, cy, durationTicks, options?)`

| Field | Type | Description |
|---|---|---|
| `options.updateMax` | `boolean` | Also update max duration |

## `setPhysicsAtCell(cx, cy, physicsState)`

| Value | Constant | Meaning |
|---|---|---|
| `0` | `api.constants.physics.normal` | Default |
| `1` | `api.constants.physics.skip` | Skip physics |
| `2` | `api.constants.physics.aggressiveSkip` | Aggressive skip |

Worker reports chunk activity after physics change.

## Data fields

```ts
getDataFieldAtCell(cellX, cellY, dataFieldNumber): number | null
setDataFieldAtCell(cellX, cellY, dataFieldNumber, value): boolean
```

`dataFieldNumber` indexes engine per-element data slots.
