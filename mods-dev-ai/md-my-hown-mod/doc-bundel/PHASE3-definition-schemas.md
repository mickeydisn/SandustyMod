# Phase 3 — Definition schemas

Date: 2026-09-26
Tool: `tools/extract-definitions.ts` (13 tests)
Artefacts: `DEFINITIONS.md`, `definitions.json`

36 register/update methods, read out of the shipped bundle rather than the
typings. The typings say what a shape *may* contain; this says what the engine
*inspects*.

## Required is not "not optional"

The single most important distinction in this phase:

> A field the body only **reads** as a value is optional. A field the body
> **dereferences** is required, because an absent field throws.

`t.id` is safe when `id` is missing — it evaluates to `undefined`. `t.sprite.id`
is not: it reaches into `undefined`. Throughout the engine api only **6 fields**
are dereferenced, so only 6 are genuinely required:

| method | required |
|---|---|
| `items.register` | `pivot`, `sprite` |
| `matters.register` | `update` |
| `upgrades.register` | `upgrade` |

`structures.register` reads nine fields and dereferences **none**, so a
structure with only an `id` registers. That is not in any documentation.

## The engine reads exactly these

| method | fields the body reads |
|---|---|
| `elements.register` | `id`, `colors`, `metaColor` |
| `structures.register` | `id`, `shape`, `render`, `buildModes`, `blockGridType`, `copyData`, `skipCopyData`, `draw`, `defaultData` |
| `terrains.register` | `id`, `materialId` |
| `items.register` | `id`, `itemType`, `sprite`, `pivot`, `x`, `y` |
| `upgrades.register` | `itemId`, `categoryId`, `itemName`, `itemNameKey`, `requirement`, `upgrade`, `onUpgrade` |
| `upgrades.registerCategory` | `id`, `name`, `nameKey`, `requirement` |
| `structures.processing.register` | `structureType`, `intervalMs`, `process` |

`structures.register` reading `render`, `buildModes` and `shape` are the nested
sub-objects Phase 3 asked for — they arrive as whole objects, not flattened.

## Validation, quoted from the engine

The throw messages are the only place the real constraints are written down, and
they are not in the typings at all:

```
terrains.register
  Terrain '<id>' has invalid materialId <n>. It must be a number > obstacleBreakpoint
  (<bp>) and < 150.
  Terrain '<id>' materialId <n> must be in range <bp+1>-149.

structures.processing.register
  Structure "<id>" must be registered before its processing.

structures.recipes.register
  Structure recipe ID "<id>" is not supported.

upgrades.registerCategory
  Upgrade category requires an id and localized name.

upgrades.registerCategory  (guard)
  if (!t.id || !t.name && !t.nameKey) throw
```

9 of the 36 methods can throw at all.

## The bug this found

`registerUpgradeCategory` in the mod did:

```ts
const { onUpgradeKey, id: _id, ...rest } = def;
g()?.api?.upgrades?.registerCategory?.(rest);
```

The `id` is **stripped**, and the engine's first line of defence is
`if (!t.id || …) throw`. So every upgrade category registration threw and the
mod silently logged `upgrades.registerCategory failed` each time. The config
type also had no `name` or `nameKey`, so even forwarding the id would not have
been enough.

Fixed: forward `id`, add `name`/`nameKey` to `UpgradeCategoryConfig`, and derive
a name from the id when the author supplied neither.

`registerUpgrade` was checked the same way and is fine — it drops the top-level
`id` deliberately because the identity lives in the nested `upgrade.id`.

## Three findings left, all benign

| finding | status |
|---|---|
| `items.register` reads `pivot`, `x`, `y` | the mod has no `registerItem` at all |
| `structures.register` reads `skipCopyData` | optional; not dereferenced |
| `upgrades.register` reads `onUpgrade` | a function; the mod uses `onUpgradeKey` by design |

## How the bodies are reached

Most engine methods are not where the work happens:

- **thin wrappers** — `structures.register` is literally `{ Ke(e, t, n) }`, so
  the wrapper is followed to reach the fields. 4 methods need this.
- **cross-module** — `tech.registerNode` is `=> (0, xe.registerTechNode)(e, t, n)`
  and `xe` is a different module. Those are marked **undetermined** rather than
  reported as reading nothing, because "no fields" and "unknown" are different
  answers.
- **i18n rewriting** — 7 methods call `xt(def, kind, id)`, which converts
  `name`/`description` into `nameKey` entries and registers them. `xt` touches
  only those four fields and *not* `descriptionParams`, so that field is inert
  on the paths that call it.

## Six more silent bugs, all in this tool

1. `bodyOf` hunted for `{` after `=>`, which for `=> (0, fn)(…)` ran into the
   **next function** and reported its fields as required — inventing
   `tech.registerNode.restore` and `.save`, which do not exist
2. `\bt\.` matched inside `$t.triggers`, inventing a required `triggers` field
   on processing
3. `var t` inside a nested arrow shadowed the parameter, so `t.indexOf` became
   a field of a terrain definition
4. `collectRegisters` keyed on namespace + name, collapsing `structures`,
   `structures.recipes` and `structures.processing` into one `register`
5. `definitionArg` assumed the definition was always the second argument, so
   `processing.register(ctx, id, definition)` had its **id** treated as the
   definition — fixed by reading the parameter names from the public typings
6. one character class for all three quote styles truncated every throw message
   at the first apostrophe in `Terrain '<id>' has invalid…`

## Open

- `tech.registerNode` and any other cross-module delegate stay undetermined
  until the other modules are in scope. The public typings are the only
  available substitute, and they list `restore`/`save` as absent, so the truth
  is unresolved.
- The engine api is the escape hatch; the main-thread public composer may read
  more fields before calling it. Everything here is a **lower bound**.
