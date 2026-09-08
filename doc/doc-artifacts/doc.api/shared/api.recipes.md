# Sandustry API — Structure recipes (`api.structures.recipes`)

> **Entry:** Main + Worker. Official: [sandkit.html](https://sandustry.com/sandkit.html). Grid writes: deferred on main, immediate on worker.


Recipes bind **input elements** to **structure behaviors** (shaker, smelter, grower, …).

---

## Surface

```ts
api.structures.recipes.register(recipeId, definition)
api.structures.recipes.getWeightedRecipe(recipeId, inputElementType) → recipe | null
api.structures.recipes.selectWeightedOutput(outputs) → elementType | null
```

---

## Supported `recipeId` values

Only these ids are accepted by `register` (others throw  
`Structure recipe ID "…" is not supported.`):

| recipeId | Machine | Definition shape |
|---|---|---|
| `"planterBox"` / grower path | Grower | `{ input, output, chance? }` |
| `"shaker"` | Shaker | `{ input, outputsAbove, outputsBelow }` |
| `"kineticPress"` | Velocity soaker / press | `{ input, minimumDownwardVelocity, outputs }` |
| `"condenser"` | Condenser | `{ input, outputs }` |
| `"steamDryer"` | Thermodryer | `{ input, outputs }` |
| `"synthesizer"` | Synthesizer | `{ input, outputs }` (+ cross-recipe constraints) |
| `"snowmaker"` | Snowmaker | `{ input, outputs }` |
| `"smelter"` | Smelter | `{ input, outputs }` |

Internal constants: `planterBox`, `shaker`, `kineticPress`, `condenser`, `steamDryer`, `synthesizer`, `snowmaker`, `smelter`.

---

## Shared types

### Element ref

```ts
input: number | string    // elementType (validated as element)
output: number | string   // single output elementType
```

### Weighted output entry

```ts
{
  elementType: number | string;   // required, valid element
  chance: number;                 // required, finite, 0..1 inclusive
}
```

`outputs` / `outputsAbove` / `outputsBelow`:

- Must be an **array**
- Max **255** entries
- Each entry must be an object with `elementType` + `chance`

---

## Per-id definition objects

### Grower / `planterBox`

```ts
{
  input: ElementRef;
  output: ElementRef;
  chance?: number;          // default 1; must be 0..1 if set
}
```

### Shaker

```ts
{
  input: ElementRef;
  outputsAbove: WeightedOutput[];
  outputsBelow: WeightedOutput[];
}
```

### Kinetic press

```ts
{
  input: ElementRef;
  minimumDownwardVelocity: number;   // finite, >= 0
  outputs: WeightedOutput[];
}
```

### Condenser / steamDryer / synthesizer / snowmaker / smelter

```ts
{
  input: ElementRef;
  outputs: WeightedOutput[];
}
```

**Synthesizer extra rules:**

- No output `elementType` may equal that recipe’s `input`
- Outputs cannot be inputs of another synthesizer recipe (and vice versa)

---

## Helpers

### `getWeightedRecipe(recipeId, inputElementType)`

Looks up the registered recipe for that machine + input element.  
Returns `null` if none.

### `selectWeightedOutput(outputs)`

Picks one `elementType` from a `WeightedOutput[]` by chance.  
Returns `null` if nothing selected.

---

## Example

```js
// Smelt custom ore into custom ingot (80%) or slag (20%)
api.structures.recipes.register("smelter", {
  input: "myMod.ore",
  outputs: [
    { elementType: "myMod.ingot", chance: 0.8 },
    { elementType: "myMod.slag", chance: 0.2 }
  ]
});

// Shaker: wet sand → sand above, water below
api.structures.recipes.register("shaker", {
  input: enums.ElementType.WetSand,
  outputsAbove: [{ elementType: enums.ElementType.Sand, chance: 1 }],
  outputsBelow: [{ elementType: enums.ElementType.Water, chance: 1 }]
});

// Grower
api.structures.recipes.register("planterBox", {
  input: "myMod.seed",
  output: "myMod.plant",
  chance: 1
});
```

---

## Notes

- `register` is **per input**: registering the same `recipeId` + same `input` replaces the previous entry for that input.
- Recipe ids are **machine kinds**, not free-form mod names — you extend the built-in machines rather than inventing a new recipe id string.
- For fully custom machines, prefer `api.structures.addProcessor` / `processing.register` instead of recipes.
- Registering some recipes also installs worker intercepts on `element:blocked` / `element:move` for the input element type.
