# Phase 2 — Object and link graph

Date: 2026-09-26
Tools: `tools/extract-object-graph.ts`, `tools/extract-object-graph.test.ts`
Artefacts: `OBJECT-GRAPH.md`, `object-graph.json`, `mod-config-drift.json`

101 types, 41 references, 23 names in the id space.

## The id space

Every cross-object reference is one of exactly three things. Mixing them up is
the classic mod bug, because the engine does not always complain.

```
ElementType  = ElementTypeEnum | TaggedNumber<"elementType">   numeric handle
ElementId    = LooseString<never>                              string id
ElementRef   = ElementType | ElementId                         either
```

| role | count | names |
|---|---|---|
| **handle** (number) | 7 | `ItemType` `PickupType` `WorldItemType` `Scene` `ElementType` `StructureType` `TerrainType` |
| **id** (string) | 10 | `ElementId` `StructureId` `TerrainId` `EventId` `FieldId` `KeyCode` `Locale` `OverlaySlot` `InterceptHookId` `ModifyHookId` |
| **ref** (either) | 6 | `ElementRef` `StructureRef` `TerrainRef` `ItemId` `ComponentId` `TechGridId` |

The rule the pickers must follow:

> A field declared `…Ref` takes **either** form and must not be forced into a
> number. A field declared `…Type` **requires** a handle and a string will be
> rejected or coerced. A field declared `…Id` **requires** the string.

Two cases are genuinely ambiguous and must be resolved at runtime, not guessed:

- `ItemId = ItemIdEnum | LooseString<never>` — despite the name it accepts
  **either**. Emitting a number here is a silent no-op, not an error.
- `TechGridId = TechEnum | LooseString<never> | TaggedNumber<"tech">` — the same,
  and it also admits a tagged number.

These are exactly the cases the mod's own `resolveStructureType()` walks
(`mysandkit.ts`), and the reason the wrapper forwards the *raw id* for recipe
machines rather than the resolved type.

## Resolution direction

Registration takes **ids**; queries take **refs** or handles:

| operation | argument | direction |
|---|---|---|
| `elements.register(def)` | `def.id: string` | id, in |
| `elements.updateDefinition(elementTypeOrId, partial)` | `ElementRef` | either |
| `elements.getTypeById(id)` | `ElementId` → `ElementType` | id → handle |
| `elements.getIdByType(type)` | `ElementType` → `ElementId` | handle → id |
| `structures.register(def)` | `def.id: StructureId` | id, in |
| `structures.processing.register(id, def)` | `StructureId` | id, in |
| `structures.recipes.register(id, def)` | machine id literal | id, in |

A definition stores its **string id** and the engine assigns the numeric handle.
Nothing in a stored definition should hold a handle, because handles are
assigned by the host and are not stable across sessions.

## Cross-object references

The links that actually matter, all confirmed from the typings:

```
ContactRecipeDefinitionV1.inputA / inputB / outputA / outputB -> ElementType  [handle]
PlanterBoxRecipeDefinitionV1.input / output                     -> ElementType  [handle]
ShakerRecipeDefinitionV1.input                                    -> ElementType  [handle]
KineticPressRecipeDefinitionV1.input                              -> ElementType  [handle]
WeightedRecipeOutput.elementType                                  -> ElementType  [handle]
WeightedRefineryRecipeDefinitionV1.input / outputs               -> WeightedRecipeOutput
ExcavationTerrainRule.cellType / terrainType                     -> TerrainRef   [ref]
ExcavationTerrainRule.outputElementType                          -> ElementRef   [ref]
StructureProcessingDefinitionV1.structureType                    -> StructureRef  [ref]
StructureProcessingDefinitionV1.process -> (Structure, StructureProcessingContext)
SandkitStructureDefinition.id                                      -> StructureId   [id]
StructureVariant.id                                               -> StructureRef  [ref]
PlacementConfigDefinition.structureId                             -> StructureId   [id]
TerrainDataAtCell.cellType                                        -> TerrainType   [handle]
WorldItem.type                                                    -> PickupType    [handle]
TechDefinition.unlocks.{structures,items}                         -> string[]      [id]
TechDefinition.requires                                           -> string[]      [id]
```

Note the asymmetry: **recipes want handles** (`ElementType`) while **excavation
rules accept refs**. A rule that stores element ids where the engine wants
handles will resolve to nothing at runtime without raising.

## Which shapes are open-ended

Six engine shapes carry `[key: string]: unknown` and therefore accept fields the
typings never mention: `ItemDefinition`, `SandkitStructureDefinition`,
`ProjectileDefinition`, `TechDefinition`, `UpgradeDefinition`,
`UpgradeCategoryDefinition`.

For those, "the mod stores a field the engine shape does not declare" is not a
finding — nothing can be wrong in that direction. It is **not** true in the
other direction: they still declare real options, so those are still counted as
unexposed.

`ElementDefinition` is *not* open-ended. Its `defaultDataFields?: { [key:
string]: number }` contains an index signature belonging to a nested field, and
treating that as the type's own signature silently disabled the whole
comparison for elements.

## Mod config vs engine definitions

11 of the mod's stored shapes now have a matched engine counterpart. Real gaps
the catalog UI does not offer yet, and which are storable in JSON:

| mod type | engine option | type | note |
|---|---|---|---|
| `StructureConfig` | `descriptionParams` | `Record<string, string \| number>` | localisation parameters |
| `StructureConfig` | `linkedClearance` | `string` | clearance definition link |
| `UpgradeCategoryConfig` | `nameKey` | `string` | category translation key |

The remaining "unexposed" fields are **functions** and are correctly absent from
a JSON store, not UI gaps:

- `ItemDefinition.handleAction`, `ItemDefinition.afterRender`
- `ProjectileDefinition.getOptions`, `ProjectileDefinition.getModData`

Two kinds of shape are deliberately not compared:

- `RecipeConfig` covers four machine kinds with different bodies, so comparing
  it against any single engine shape misreports every field.
- `SignalConfig`, `TriggerConfig`, `SpriteConfig`, `EnergyTypeConfig`,
  `StructureBehaviorConfig`, `ModifierConfig`, `InteractionConfig` have no
  `*Definition` shape declared at all.

## Four more parser bugs, all silent

Every one produced plausible output rather than an error:

1. **nested interface members** were recorded as top-level fields, so
   `TechDefinition` appeared to have `items` and `structures` of its own and the
   mod's correct `unlocks` looked wrong
2. a **vague redeclaration shadowed a precise one** — `signals.d.ts` declares
   `StructureType = unknown` and it was indexed first, so `StructureRef` lost its
   numeric half and was misread as a plain string id
3. **alias chains** were not resolved — `ElementRef = ElementType | ElementId`
   names two other types rather than a `LooseString<…>`, so it classified as
   neither handle nor id
4. a union admitting **both** a number and a string was called a handle

Number 1 was the most damaging: it invented two phantom engine options and hid
the real finding that `TechConfig` actually matches.

## Open

- The 7 unmatched mod shapes need their engine counterparts identified by hand.
  Some may genuinely have no definition type; that is worth confirming rather
  than assuming.
- Whether the engine *validates* a bad reference or silently drops it is not
  stated anywhere in the typings. The evidence here is that it silently drops
  it, but that is inference from behaviour, not a documented guarantee.
- Phase 3 can now take its field lists from the graph rather than from the
  bundle, with 229 + 91 real top-level fields.

