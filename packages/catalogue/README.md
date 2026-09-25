# @sandmd/catalogue

Build-list and picker primitives for Sandustry-style mods.

The active package exposes list, picker, and explicit structure helpers.

- **`list`** — `createBuildList`, a UI-agnostic selection + catalogue controller (select, mirror,
  category, place/remove events) and helpers to map between logical item ids and world structure
  types.
- **`picker`** — `createPickerOverlay`, a React overlay that renders the catalogue with category,
  path, tag and size filters, swatches, mirroring, and persisted selection.
- **`structure`** — explicit helpers for structure definitions, shapes, and aligned drawing.

Catalogue items must declare `tags`, `sizes`, and `align`. `createBuildList` also requires a
`selectedId` that exists in the item list, so no implicit first-item selection remains.

## Install / import

```ts
import {
    buildCustomDraw,
    buildStructureDefinition,
    createBuildList,
    createPickerOverlay,
    makeShape,
    typeOfCatalogueItem,
} from "@sandmd/catalogue";
import type { BuildList, CatalogueItem, ResolvedCatalogueItem } from "@sandmd/catalogue";
```

## Quick start

```ts
import { createBuildList, typeOfCatalogueItem } from "@sandmd/catalogue";
import type { CatalogueItem } from "@sandmd/catalogue";

const items: CatalogueItem[] = [{
    id: "vase",
    label: "Vase",
    description: "A decorative vase.",
    category: "deco",
    path: "assets/deco",
    width: 16,
    height: 24,
    tags: ["decorative"],
    sizes: ["1x1"],
    align: "floor",
}];

const list = createBuildList({
    modId: "my-mod",
    menuId: "my-mod:catalogue/opener",
    menuLabel: "Catalogue",
    catalogueItems: items,
    selectedId: "vase",
});

list.setSelected("vase");
list.setMirrored(false);
console.log(list.getSelectedType());
console.log(typeOfCatalogueItem("my-mod", "vase", true));
```

## API

### Build list (`list`)

- `createBuildList(options)` — returns a `BuildList`; emits `select`, `place`, `remove`, `category`,
  and `mirror` events via `list.on(name, fn)`.
- `getSelected()` / `getSelectedType()` / `setSelected(id)` — selection state
- `isMirrored()` / `setMirrored(bool)` — mirror flag (adds `~mirrored` suffix)
- `getCategory()` / `setCategory(id)` / `itemsInCategory(id?)` / `countIn(id)`
- `structureType(itemId, mirrored?)` / `itemFromType(type)` — id ↔ type mapping
- `notifyPlace(x, y, type?)` / `notifyRemove(x, y, type)` — report bridges built
- `applyToBuildTool()` — hand the current selection to the build tool

`selectedId` is required and must exist in `catalogueItems`; invalid or empty catalogues throw at
construction time.

### Picker (`picker`)

- `createPickerOverlay(options)` — requires `pickerId`, `slot`, `title`, `persistSelection`,
  `unlockTypes`, and `spriteIdFor`; `itemFilter` and `onSelect` are optional hooks.

### Structure helpers

- `makeShape(width, height)` creates an empty structure shape.
- `buildStructureDefinition(options)` requires category, visibility, render, shape, variants, build
  modes, and default data explicitly.
- `buildCustomDraw(item, spriteId)` draws a resolved catalogue item with its declared alignment and
  mirror flag. The misspelled public name `buildCustumDraw` remains as a compatibility alias.
- `typeOfCatalogueItem(modId, itemId, mirrored)` maps a logical item to its world structure type.

## Configuration rule

Do not rely on omitted catalogue metadata or picker layout values. Declare them in the catalogue
item or in the caller configuration. This keeps rendering, selection, and structure registration
decisions visible at the call site.
