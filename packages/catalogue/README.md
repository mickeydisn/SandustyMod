# @sandmd/catalogue

Build catalogue, picker UI, placement helpers, and multi-cell shape helpers for
Sandusty-style mods.

The package is split into four concerns:

- **`list`** — `createBuildList`, a UI-agnostic selection + catalogue controller
  (select, mirror, category, place/remove events) and helpers to map between
  logical item ids and world structure types.
- **`picker`** — `createPickerOverlay`, a React overlay that renders the
  catalogue with search, swatches, mirroring, and persisted selection.
- **`align`** — grid/metrics helpers to compute where a deco sprite is drawn,
  with `floor` / `wall` / `center` alignment.
- **`shape`** — `applyCellsOption` to turn a `cells` footprint into a filled
  `shape` + `renderSize` used when registering structures.

## Install / import

```ts
import {
  createBuildList,
  createPickerOverlay,
  structureTypeFor,
  itemIdFromType,
  isMirroredType,
  getGridMetrics,
  computeAlignedRect,
  resolveAlign,
  applyCellsOption,
} from "@sandmd/catalogue";
import type { BuildList, CatalogueCategory, CatalogueItem } from "@sandmd/catalogue";
```

## Quick start

```ts
import { createBuildList, structureTypeFor } from "@sandmd/catalogue";

const list = createBuildList({
  modId: "my-mod",
  menuId: "my-mod:catalogue/opener", // single build-menu entry that opens the picker
  menuLabel: "Catalogue",
  categories: [{ id: "deco", label: "Decoration" }],
  items: [{ id: "vase", label: "Vase", category: "deco", width: 16, height: 24 }],
});

list.setSelected("vase");
list.setMirrored(false);
console.log(list.getSelectedType()); // my-mod:item/vase
console.log(structureTypeFor("my-mod", "vase", true)); // my-mod:item/vase~mirrored
```

## API

### Build list (`list`)

- `createBuildList(options)` — returns a `BuildList`; emits `select`, `place`,
  `remove`, `category`, and `mirror` events via `list.on(name, fn)`.
- `getSelected()` / `getSelectedType()` / `setSelected(id)` — selection state
- `isMirrored()` / `setMirrored(bool)` — mirror flag (adds `~mirrored` suffix)
- `getCategory()` / `setCategory(id)` / `itemsInCategory(id?)` / `countIn(id)`
- `structureType(itemId, mirrored?)` / `itemFromType(type)` — id ↔ type mapping
- `notifyPlace(x, y, type?)` / `notifyRemove(x, y, type)` — report bridges built
- `applyToBuildTool()` — hand the current selection to the build tool

Type helpers:
- `structureTypeFor(modId, itemId, mirrored?)` → `my-mod:item/<id>[~mirrored]`
- `itemIdFromType(modId, type)` → the `itemId` (or `null`)
- `isMirroredType(type)` → whether the type carries the mirror suffix

### Picker (`picker`)

- `createPickerOverlay(options)` — returns a `PickerOverlay` with
  `expand()`, `minimize()`, `close()`, `sync()`, `dispose()`. Options include
  `search`, `persistSelection`, `itemFilter`, `priceFor`, `onSelect`,
  `unlockTypes`, `spriteIdFor`, and slot/id overrides.

### Alignment (`align`)

- `getGridMetrics(fallback?)` — current cell metrics from the renderer
- `computeAlignedRect(cellOrigin, options, metrics)` → aligned draw rect
- `resolveAlign(data?, fallback = "floor")` → `"floor" | "wall" | "center"`
- `drawImageAligned(ctx, image, rect)` — draw with optional horizontal mirror

### Shapes (`shape`)

- `applyCellsOption(opts)` — fills `shape` and `renderSize` from a
  `cells: number | { w, h }` footprint when they are missing.

## Example

See [`exemple/main.ts`](./exemple/main.ts) for a build list, type-id helpers,
picker overlay, alignment computation, and the `applyCellsOption` shape helper.
