# Structure definition objects

Used by **Main entry** `api.structures.register` / `updateDefinition` / related helpers.  
Official examples: [sandkit.html](https://sandustry.com/sandkit.html) → Main → `api.structures`.

Parent API: [../shared/api.structures.md](../shared/api.structures.md)

---

## `register(definition, options?)`

### `definition`

```ts
{
  id: string;                          // required unique id
  name?: string;                       // display fallback
  nameKey?: string;                    // i18n key
  description?: string;
  descriptionKey?: string;
  categoryKey?: string;                // build menu category, e.g. "logistics"
  order?: number;                      // sort in category

  buildModes: BuildMode[];             // at least one
  shape?: number[][];                  // cell footprint matrix (1 = occupied)
  variants?: StructureVariant[];

  defaultData?: Record<string, any>;   // per-instance data
  copyData?: boolean | string[];       // which data fields copy on blueprint

  linkedClearance?: "allOrNothing" | string;

  render?: {
    imageName?: string;
    size?: { width: number; height: number };
  };
  // bundle also accepts imageName / spritesheet at top level:
  imageName?: string;
  spritesheet?: {
    frameSize?: { width: number; height: number };
    // frame layout depends on asset
  };

  tooltipHover?: TooltipHover;         // see below

  // draw / behavior hooks may exist depending on version
}
```

### `BuildMode`

```ts
{
  type: "line" | "rectangle" | "single"
      | "launcherRectUp" | "launcherRectSide"
      | string;
  directions?: Array<"horizontal" | "vertical" | "diagonal">;
  spanTiles?: number;                  // fixed span for junctions / lines
}
```

```js
buildModes: [{
  type: "line",
  directions: ["horizontal", "vertical"],
  spanTiles: 4,
}]
```

### `StructureVariant`

```ts
{
  id: string;
  angles?: number[];                   // e.g. [-180, -90, 0, 90, 180]
  // shape / image overrides possible in engine variants
}
```

```js
api.structures.registerVariant("exampleStructure", {
  id: "exampleStructureVertical",
  angles: [-90, 90],
}, {
  addBuildMode: {
    type: "line",
    directions: ["vertical"],
    spanTiles: 4,
  },
});
```

### `TooltipHover`

```ts
{
  type: "custom";
  dataFieldMessage: {
    message?: string;
    messageKey?: string;
    fields: Array<{
      param: string;                   // placeholder in message {param}
      field: string;                   // structure.data field
      fallback?: any;
      round?: boolean;
      valueLabels?: Record<string, string>;
      valueKeys?: Record<string, string>;  // i18n per value
    }>;
  };
}
```

### `options` on `register` / `updateDefinition` / `update`

```ts
{
  propagateToWorkers?: boolean;        // push instance changes to workers
  // other engine flags may exist
}
```

```js
api.structures.update(structure, { propagateToWorkers: true });
api.structures.updateData(structure, { mode: "allow" }, { propagateToWorkers: true });
```

---

## `registerPlacementConfig(definition)`

Pre-build UI fields written into `structure.data` on place.

```ts
{
  structureId: string;
  fields: Array<
    | {
        type: "integer";
        id: string;
        label?: string;
        labelKey?: string;
        default: number;
        min?: number;
        max?: number;
      }
    | {
        type: "choice";
        id: string;
        label?: string;
        labelKey?: string;
        default: string;
        options: Array<{
          value: string;
          label?: string;
          labelKey?: string;
        }>;
      }
  >;
}
```

---

## `processing.register(id, definition)`

```ts
{
  structureType: string;               // structure id to attach to
  intervalMs: number;
  process: (structure, context) => void;
}
```

### `context` (inside process)

```ts
context.getResolvedTypeAtCell(cx, cy)  // alias getElementTypeAtCell
context.isCellEmptyAtCell(cx, cy)      // alias isCellEmpty
context.commit(mutations)
context.isEnabledAtCell(cx, cy)
context.setEnabledAtCell(cx, cy, enabled)  // Main for set
```

---

## `recipes.register(id, definition)`

```ts
{
  input: string | number;              // element id or type
  outputs: Array<{
    elementType: string | number;
    chance: number;                    // 0..1
  }>;
  minimumDownwardVelocityCellsPerSecond?: number;
}
```

```js
api.structures.recipes.register("kineticPress", {
  input: "sand",
  outputs: [{ elementType: "compressedSand", chance: 1 }],
  minimumDownwardVelocityCellsPerSecond: 20,
});
```

---

## `buildAtCell` / `remove*` options

```ts
options?: {
  // engine-specific; often empty for default place
  // prefer WhenIdle aliases only when you need deferred main path
}
```
