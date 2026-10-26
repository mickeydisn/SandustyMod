# Panel Update Plan — every register panel gets a complete, unambiguous form

> **Workspace:** `mods-dev-ai/md-my-hown-mod-docs/` (all edits stay in this directory).
> **Reference / source of truth:** `mods-dev-ai/md-my-hown-mod/src/register/**` + `mods-dev-ai/md-my-hown-mod/src/packages/**`
> (config shapes come from `packages/mysandkit/types.ts`, `packages/mysandkit/host-types/domain.d.ts`,
> and `constants.ts` — imported by `register/index.ts` as `ModConfig`).
>
> **Goal:** for every object the mod registers, the editor form in `js/schema.js` (`FIELDS`) must be
> **complete** (every key the register step reads is editable), **typed** (no `type:"json"` "Free JSON"
> textareas anywhere) and **unambiguous** (labels, selects, required flags and conditional visibility
> matching what the register actually accepts).

Every item below is **unchecked = not done yet**. Tick a box only when the code is changed *and* the
collection has been verified in the browser (create → edit → save → export).

---

## 0. Audit snapshot (2026-10-09)

Sources read for this audit: `src/register/index.ts` + all 24 files under `src/register/core|custom`,
`src/packages/mysandkit/types.ts`, `src/packages/mysandkit/host-types/domain.d.ts`, `src/constants.ts`
(`ModConfig` + per-collection config interfaces), against `md-my-hown-mod-docs/js/schema.js`
(`MENU_GROUPS` L10-97, `FIELDS` L111-137, `FIELD_SECTIONS` L2787-2947, `SECTION_ORDER` L2948-3016)
and `js/editor.js` (`fieldControl` L362-386, save path L469-482).

**Totals:** 25 collections in `ModConfig` · 25 menu items in the docs panel · 26 `FIELDS` rows ·
**36 fields typed `"json"` (Free JSON)** · **1 collection with no panel at all** (`interactions`) ·
**8 collections whose form keys do not match what the register reads**.

### Per-collection audit table

| Collection | Registered by | `FIELDS` row | free-JSON | wrong keys | missing keys | done |
|---|---|---|---|---|---|---|
| elements | `register/core/elements.ts` | `schema.js:112` | 4 | – | `collectable`, flammable object form | [ ] |
| terrains | `register/core/terrains.ts` | `schema.js:113` | 7 | – | `descriptionKey`, `displayNameOverrideKey`, `fogElementType`, `burnDurationRandom`, `fireDurationRandom` | [ ] |
| structures | `register/core/structures.ts` | `schema.js:114` | 7 | – | `energyType` (read by `register/custom/energy-networks.ts`) | [ ] |
| items | `register/core/items.ts` | `schema.js:115` | 1 (`sprite`) | – | – | [ ] |
| sprites | `register/core/sprites.ts` | `schema.js:116` | 1 (`options`) | – | – | [ ] |
| buffers | `BufferEntryConfig` (`constants.ts`) | `schema.js:117` | 0 | **`value`, `numberValue`** | `path`, `type`, `default`, `min`, `max` | [ ] |
| contacts | `register/core/contacts.ts` | `schema.js:118` | 0 | – | orientation enum | [ ] |
| recipes | `register/core/recipes.ts` | `schema.js:119` | 3 | – | conditional fields per machine | [ ] |
| processing | `register/core/processing.ts` | `schema.js:120` | 0 | `handlerKey` (stripped, unused) | – | [ ] |
| techs | `register/core/techs.ts` | `schema.js:121` | 3 (`cost` is really a **number**) | – | `parentId`, `preferredPosition`, `currencyType`, `branch`, … | [ ] |
| unlockNodes | `register/core/techs.ts` | `schema.js:122` | 0 | – | **`kind` (required)**, `cost`, `currencyType`, `branch`, `parentId`, `requires`, `techId` | [ ] |
| upgrades | `register/core/upgrades.ts` | `schema.js:123` | 2 | `name`, `category`, `maxLevel`, `costs`, `targets` at top level | `itemId`, `categoryId`, nested `upgrade{…}`, `requirement`, `onUpgradeKey` | [ ] |
| upgradeCategories | `register/core/upgrades.ts` | `schema.js:124` | 0 | **`order`** (not a field) | `categoryId` (required), `itemId`, `itemName`, `itemNameKey`, `nameKey`, `requirement`, `upgrade`, `onUpgradeKey` | [ ] |
| triggers | `register/core/schedules.ts` | `schema.js:125` | 1 (`extra`) | `handlerKey` never read by the step | `processId` (what `compileEntryProcess` reads) | [ ] |
| signals | `register/core/schedules.ts` | `schema.js:126` | 0 | `handlerKey` never read | `processId` semantics | [ ] |
| modifiers | `register/custom/modifiers.ts` | `schema.js:127` | 1 (`options`) | `processId` unused by `applyModifier` | – | [ ] |
| inputBindings | `register/core/input-bindings.ts` | `schema.js:128` | 2 | – | – | [ ] |
| energyNetworks | `register/custom/energy-networks.ts` | `schema.js:129` | 0 | `description` unused | – | [ ] |
| energyTypes | `register/core/energy.ts` | `schema.js:130` | 0 | **`name`, `network`** | **`structureId`**, **`type`**, `options{capacity,energyType,priority}` | [ ] |
| projectiles | `register/core/projectiles.ts` | `schema.js:131` | 1 (`options`) | **`sprite` as text** (register needs `{id,tint}`), `name` unused | `sprite.id`, `sprite.tint`, `getOptionsKey` | [ ] |
| excavationProfiles | `register/core/energy.ts` | `schema.js:132` | 1 (`options`) | `name` unused | **`power` (required)**, **`pattern` (required)**, `terrainRules[]` | [ ] |
| structureBehaviors | `register/core/structure-behaviors.ts` | `schema.js:133` | 1 (`behavior`) | **`structureId`** | **`kind` (`conveyor`\|`launcher`)**, `definition` | [ ] |
| placementConfigs | `register/core/placement-configs.ts` | `schema.js:134` | 1 (`fields`) | – | structured `PlacementField[]` (integer/choice) | [ ] |
| processes | `ProcessRegistry` (`register/index.ts`) | `schema.js:135` | 0 | – | – | [ ] |
| programV2 | docs-only alias of `processes` | `schema.js:136` | 0 | – | – | [ ] |
| **interactions** | **`register/core/interactions.ts`** | **absent** | – | – | **whole collection: menu item, `FIELDS`, sections, docs article, graph node** | [ ] |

**Editor-level findings (these block the "no Free JSON" standard):**

- [ ] `js/editor.js` **Save overwrites the form with a stale Raw-JSON snapshot** — `renderForm` writes
      `#ed-raw` once at open (L462), `readFormInto` applies the form (L470), then L471-477 re-parses the
      untouched textarea and `Object.assign`s it back over the entry. The form is therefore *not* the
      source of truth. Make the form authoritative; Raw JSON becomes a read-only mirror (or is removed).

- [ ] The `type:"json"` Free-JSON textarea is rendered by `fieldControl` (editor.js L377-381) and
      `readFormInto` keeps the raw string when parsing fails (L398-400) → **36 form fields** currently
      accept ambiguous free text. Remove every `"json"` row from `FIELDS` (Phases 3-5).
- [ ] Unknown field types silently fall through to a plain text input (editor.js L382-385) → a typo in a
      `type` produces an ambiguous control instead of an error. Fail loudly (`console.error` + badge).
- [ ] `required` only appends a `*`; nothing blocks Save. Add validation (required, number
      min/max/step, `pattern` — reuse the mod's `ID_PATTERN` semantics from `ui/definition/fields.ts`).
- [ ] `select` renders an empty `—` option even for required fields, and a current value outside
      `options` displays as blank (silently losing data). Fix: flag invalid values; allow a custom value
      only where the register type is an open string.

---

## Phase 1 — Editor plumbing (prerequisites, no content yet)

- [ ] `js/editor.js` — make the **form** the single source of truth on Save; stop re-reading `#ed-raw`
      (L469-482). Keep Raw JSON as a read-only preview refreshed from the entry, or delete the block.
- [x] `js/editor.js` — add control kinds next to `text|number|bool|select|json`: `list` (repeatable rows
      of sub-fields), `kv` (key/value pairs), `matrix` (number[][] editor), `color` (swatch + hex ⇄
      packed int), `tags` (string[] chips), `ref` (input + `<datalist>` of ids already in the config),
      `fieldset` (nested object), `pair` (two numbers, e.g. `{min,max}`).
- [ ] `js/editor.js` — support `extra.when(form)` conditional visibility (recipes by machine kind,
      structure-behaviour by `kind`, placement field by `type`) and
      `extra.min|max|step|pattern|placeholder` on inputs.
- [ ] `js/editor.js` — `readFormInto` must reject/flag values a control cannot represent instead of
      storing strings where the register expects objects/arrays (today's silent `catch` fallback).
- [ ] `js/editor.js` — unknown field `type` → console error + visible badge (no silent text input).
- [x] `js/schema.js` — give **every** collection a complete `FIELD_SECTIONS` map + `SECTION_ORDER`
      (only 13 of 26 rows are mapped today, everything else dumps into "Other"): add `buffers`,
      `contacts`, `sprites`, `unlockNodes`, `upgradeCategories`, `modifiers`, `inputBindings`,
      `energyNetworks`, `energyTypes`, `projectiles`, `excavationProfiles`, `structureBehaviors`,
      `placementConfigs`.
- [x] `js/editor.js` — seed `+ Add` with the register-required defaults: `energyTypes.type:"conductor"`,
      `structureBehaviors.kind:"conveyor"`, `unlockNodes.kind:"always"`, `recipes.kind:"structure"`,
      `signals.kind:"targets"`, `modifiers.enabled:true`, `elements.matterType:"Solid"`.
- [ ] Smoke check: serve the site, add one entry in **every** collection, Save, Export → no exported
      value is a stringified object/array and no key was silently dropped.

## Phase 2 — Forms whose keys do not match the register (broken, highest priority)

- [x] **buffers** (`schema.js:117`) — replace `value`/`numberValue` with the real `BufferEntryConfig`:
      `path` (text, required), `type` (select `number|bool|string`), `default` (typed by `type`),
      `min`, `max` (numbers). Sections: Identity / Path / Range.
- [x] **energyTypes** (`schema.js:130`) — drop `name`/`network`; add `structureId` (ref → structures,
      required), `type` (select `conductor|storage`, required), `options.capacity` (number),
      `options.energyType` (ref → energyNetworks), `options.priority` (number).
- [x] **excavationProfiles** (`schema.js:132`) — drop `name`; add `power` (number, required),
      `pattern` (matrix, required), `terrainRules` (Phase 4 list), and `options` as flags:
      `fromGun`, `fromRocketExplosion`, `fromDrill`, `useLiteralOutVelocity`, `destroyNonDestructible`,
      `forceRemoveAll` (bool) + `drillTierDamage` (number).
- [x] **structureBehaviors** (`schema.js:133`) — drop `structureId`; add `kind` (select
      `conveyor|launcher`, required) and a `when`-dependent `definition` fieldset (conveyor:
      `{id, options…}`; launcher: launcher payload) — mirror `register/core/structure-behaviors.ts`.
- [x] **upgrades** (`schema.js:123`) — rebuild to `UpgradeConfig`: `itemId` (ref → items, required),
      `categoryId` (ref → upgradeCategories, required), `itemName`, `itemNameKey`, `onUpgradeKey`,
      `processId` (ref → processes — what `compileEntryProcess(rest, "upgrade")` reads), `requirement`
      fieldset, and nested `upgrade{ id, nameKey, descriptionKey, maxLevel, costs[], oneOff }`.
      Remove top-level `name` / `category` / `maxLevel` / `costs` / `targets`.
- [x] **upgradeCategories** (`schema.js:124`) — remove `order` (not a field); add `categoryId`
      (required), `name`, `nameKey`, `itemId`, `itemName`, `itemNameKey`, `requirement`, `upgrade`,
      `onUpgradeKey`.
- [x] **projectiles** (`schema.js:131`) — `sprite` must become `sprite.id` (ref → sprites, required)
      + `sprite.tint` (color/number); add `getOptionsKey` (text) and `options` (Phase 5); drop `name`;
      hint that `register/core/projectiles.ts` synthesises `sprite.id = "<id>-sprite"` when missing.
- [x] **processing** (`schema.js:120`) — `handlerKey` is destructured out and never used
      (`register/core/processing.ts` L33): remove it or label it "stored only"; keep `structureType`
      (ref → structures, **required**), `intervalMs` (number, **required**, min 1 — the host throws on
      non-positive values), `processId` (ref → processes).
- [x] **triggers** (`schema.js:125`) — `handlerKey` is never read by `registerTriggers`; the compiler
      reads **`processId`** (`handler/processing/custom-process/entry.ts` → `processRefOf`). Swap the
      field; keep `triggerId`, `interval` (default 60), `sequentialRuns` (default 1); `extra` → Phase 3.
- [x] **signals** (`schema.js:126`) — same `handlerKey` vs `processId` issue: make `processId`
      (ref → processes) primary; keep `kind` select (`targets|interactables|senderType`) and make
      `target` a `ref` whose source follows `kind`, with a note that `senderType` registers as
      `sender` (`register/core/schedules.ts` L20-24).
- [x] **modifiers** (`schema.js:127`) — `processId` is not read by `applyModifier`
      (`handler/engine/apply.ts`): remove or relabel "stored only"; make `handlerKey` a select of the
      known modifier actions, `hookId` required, `kind` select `intercept|modify`, `options` → Phase 3.
- [x] **contacts** (`schema.js:118`) — `outputA`/`outputB` are `string | number | null`: add an explicit
      "nothing" choice instead of an empty text box; make `orientation` a select once the accepted
      values are verified against `api.reactions.registerContact`.
- [x] **items** (`schema.js:115`) — split the `sprite` JSON box into `sprite.id` (ref → sprites,
      required), `sprite.type`, `sprite.mount`; give `itemType` and `type` non-overlapping labels
      (`type` is the raw engine alias, `itemType` the Weapon/Tool/Consumable/Mod class).
- [x] **structures unlock/caps** (`schema.js:114`) — document the `unlockNode` (mod alias) ↔
      `unlockedBy` (engine field) mapping, and that `maxPlaced`, `drawKey`, `unlockNode` are stripped
      before the host call (`register/core/structures.ts` → `withoutModOnlyKeys`); keep the
      `hideFromBuildMenu` / `alwaysUnlocked` behaviour notes from `unlockStructures`.

## Phase 3 — Replace scalar-shaped Free JSON with typed controls

- [x] `elements.durationRandom` `{min,max}` → `pair` of two numbers (sections
      `durationRandomMin/Max` are already reserved in `FIELD_SECTIONS`).
- [x] `elements.metaColor` / `terrains.metaColor` → `color` control that writes the packed integer the
      type expects (`number`), replacing the `0xRRGGBB` text hint.
- [x] `elements.defaultDataFields` `Record<string,number>` → `kv` grid with numeric values only.
- [x] `terrains.colorHSL` `[h,s,l]` → three numbers (`colorHSLHue/Saturation/Lightness` already
      reserved in `FIELD_SECTIONS`) with ranges 0-360 / 0-100 / 0-100.
- [x] `terrains.output` `{elementType, chance}` → element `ref` + chance number (keys
      `outputElement`/`outputChance` already reserved) plus an explicit "drops nothing" option —
      `elementType: null` is a real value (`register/core/terrains.ts` L116-127).
- [x] `terrains.excavationRequirements` `string[]` → `tags` control.
- [x] `techs.cost` → plain **number** (it is `cost?: number`, not JSON).
- [x] `techs.requires` `string|string[]` → `tags` control (single value = one chip).
- [x] `inputBindings.defaultKeys` `string[]` → `tags` control (e.g. `KeyO`).
- [x] `inputBindings.subsection` → four text fields: `title`, `titleKey`, `description`,
      `descriptionKey`.
- [x] `structures.registerOptions` `{useRawShape?}` → single bool + note that it is wrapper-only
      (passed as a separate argument and stripped from the body).
- [x] `energyTypes.options` → the flat fields already listed in Phase 2 — **no** JSON box.
- [x] `sprites.options` → `kv` grid; first verify which option keys `api.sprites.load/loadFromMod`
      honour (`packages/mysandkit/api/sprites.ts` passes `Record<string, unknown>` through untouched)
      and offer known keys as a datalist.
- [x] `modifiers.options` → `kv` grid with a hint naming the options the selected `handlerKey` reads.
- [x] `triggers.extra` → `kv` grid (passed through to `api.triggers.register`).

## Phase 4 — Replace list-shaped Free JSON with repeatable row editors

- [x] `recipes.outputs` / `outputsAbove` / `outputsBelow` → `list` rows
      `{elementType (ref), chance (0-1)}` **with `when(kind)`**: `planterBox` shows `output`+`chance`,
      `shaker` shows Above/Below, `kineticPress` shows `outputs`+`minimumDownwardVelocity`, all other
      machines show `outputs` only — mirror `register/core/recipes.ts` `resolveBody` exactly.
- [ ] `placementConfigs.fields` → `list` rows over the `PlacementField` union: `type` select
      (`integer|choice`), `id`, `label`, `labelKey`, `min`, `max` (number **or**
      `{itemId, upgradeId, minimum, offset}` — inline toggle), `default`, and for `choice` an inner
      `options[]` list `{value, label, labelKey}`. Mirror `PlacementConfigDefinition` in
      `host-types/domain.d.ts`.
- [ ] **New** `excavationProfiles.terrainRules` → `list` rows
      `{cellType (terrain ref), damage (number), outputElementType (element ref)}`
      (`register/core/energy.ts` → `terrainRule`).
- [x] `structures.shape` → `matrix` editor (rows/cols, 1 = occupied) with row/column add+remove.
- [x] `structures.buildModes` → `list` rows `{type (select from BUILD_MODES), directions (tags)}`.
- [x] `structures.variants` → `list` rows `{id, angles (numbers)}`.
- [x] `techs.unlocks` → `unlockStructures[]` (ref → structures), `unlockItems[]` (ref → items),
      `map` (bool) — keys already reserved in `FIELD_SECTIONS`.
- [x] `techs.preferredPosition` → `pair` `{row, col}` numbers, visible only when `parentId` is set.
- [x] `upgrades.upgrade.costs` → number list; `unlockNodes.requires` → `tags`.
- [x] `elements.colors.variants` → `list` of `color` rows (RGBA), plus the `variantFromDataField1`
      fieldset `{rangeMin, rangeMax, invert, useGradient}`.
- [x] `terrains.colorGradient.stops` → `list` rows `{hp (number), color (color)}`.
- [ ] `energyNetworks` — keep minimal (`id`, `name`) but add a warning hint mirroring
      `register/custom/energy-networks.ts`: a network nothing joins has no effect on the simulation.

## Phase 5 — Replace deep/polymorphic Free JSON (the hardest controls)

- [ ] `structures.render` → fieldset: `imageName` (ref → sprites), `size{width,height}`,
      `offset{x,y}`, `ui{size|width|height|offset|objectPosition|clipToBounds|imageName}`,
      `spritesheet{…}` — types from `StructureRender` / `StructureRenderUi` in
      `host-types/domain.d.ts`.
- [x] `structures.tooltipHover` → **typed, not `kv`** (already correct; verified against the
      register): `type` select `{filter, custom}` (optional — the register returns `undefined`
      when `messageKey` is empty), and under `when:{type:"custom"}` a required `messageKey` text
      plus a single-row `list` of `{field, param, fallback}` where `field` is an optional number
      `1–4` (the host keeps it only when it is an integer in that range). Both keys and the field
      row are sectioned under **Tooltip**. Index-doc table updated to spell out the
      "one field descriptor" and "empty messageKey ⇒ whole object omitted" rules.
      Runtime path pruning verified: switching `custom → filter` removes the whole
      `dataFieldMessage` sub-object; clearing the type removes `tooltipHover` entirely.
- [ ] `structures.defaultData` → `kv` grid typed `Record<string, unknown>` with scalar-only value
      validation (**still a free-JSON box today — Phase 5 item remains open**).
- [ ] `elements.interactions` **and** `terrains.interactions` → `list` rows over the `Interaction`
      union: `kind` select (`structure|entity|destroyer|flammable|meltable|freezable|custom`) with
      `when` fieldsets (`structures[]`, `entities[]`, `items[]`) plus the shared metadata
      `textKey`, `crossedOutWhen{dataField,equals}`, `visibleWhen{dataField,equals}`,
      `onlyWhenTranslated`.
- [ ] `elements.flammable` → toggle `bool` vs object fieldset (`outputElementId`, `outputChance`,
      `fireInheritsDuration`, `duration`) — `ElementFlammable`; the `Flammable` section is already
      reserved in `FIELD_SECTIONS`.
- [ ] `elements.collectable` → add fieldset `{value}` (the `Collectable` section is already reserved).
- [x] `terrains.colorPattern` → `matrix` control for `size` plus a per-cell `color` grid
      (`colorsHSL` RGBA cells).
- [x] `terrains.background` → typed fieldset after verifying what the host reads (`TerrainConfig`
      types it `Record<string, unknown>`); if the keys cannot be enumerated, use a `kv` grid with a
      "verify against host" note — **not** a free JSON box.
- [ ] `projectiles.options` → structured control modelled on the mod's projectile-option shape
      (cross-check `ui/definition/core/projectile.ts`, which already treats it as a dedicated kind).
- [ ] `structureBehaviors.definition` → per-`kind` fieldset (uses the `when` hooks from Phase 2).
- [ ] `upgrades.requirement` / `upgradeCategories.requirement|upgrade` → fieldsets after reading what
      `api.upgrades.registerCategory` / `api.upgrades.register` actually consume.

## Phase 6 — Missing collection & missing fields

- [ ] **Add the `interactions` panel**: `MENU_GROUPS` item (group `elements`, `nest:1`),
      `FIELDS.interactions` = `id`, `elementId` (element ref, required), `interaction` (Phase 5 union
      editor), plus `FIELD_SECTIONS` / `SECTION_ORDER` rows. `emptyConfig()` already force-adds
      `interactions: []` (`schema.js:5966`) but there is **no way to author it** in the panel.
- [ ] `index.html` — add the `#c-interactions` article + field table
      (`register/core/interactions.ts` → `api.elements.addInteractionInfo`).
- [ ] `js/graph.js` — add the `interactions` node + edge `interactions → elements : elementId`.
- [ ] `js/app.js` — add `c-interactions → content` to `ANCHOR_PAGE`.
- [ ] **terrains**: add `descriptionKey`, `displayNameOverrideKey`, `fogElementType` (element ref),
      `burnDurationRandom` / `fireDurationRandom` (`pair` min/max).
- [ ] **structures**: add `energyType` (string, network ref) — read by
      `register/custom/energy-networks.ts` to detect joined networks; document the
      `disallowPick` ⇄ `disallowSelection` mapping.
- [ ] **techs**: add `currencyType`, `branch`, `parentId` (drives `api.tech.registerNode`),
      `preferredPosition`, `icon.spriteName` (sprite ref), `threshold`, `locked`, `radiusUnlockPx`,
      `isElectricity`, `electricityNodeStyle`, `isAlien`, `unavailable`, `nameParams`,
      `descriptionParams`.
- [ ] **unlockNodes**: add `kind` (select `always|tech`, **required** — `registerTechs` skips nodes
      without it), `cost`, `currencyType`, `branch`, `parentId`, `techId`.
- [ ] **sprites**: express the loader precedence of `register/core/sprites.ts` in the form —
      `source:` data-URL → sprite-editor loader, `path` + `fromMod !== false` → `loadFromMod`,
      else `load` — as help text + `when` visibility.
- [ ] **processes / programV2**: confirm `CustomProcessConfig`
      (`handler/processing/custom-process/types.ts`) is fully covered (`id`, `name`, `scope`, `doc`,
      `steps`, tags) and add anything missing.
- [ ] Guard: add a dev assertion that every key of `DEFAULT_CONFIG` (`constants.ts`) has both a
      `MENU_GROUPS` item and a `FIELDS` row — this is what would have caught `interactions`.


## Phase 7 — Ambiguity pass (labels, enums, constraints)

- [ ] Give **every** select a real option set taken from the register/types:
      `matterType` (`MATTER` ✓), `structures.categoryKey` (game categories ✓), `recipes.kind`
      (`RECIPE_KINDS` ✓), `processes.scope` (`SLOTS` ✓), `signals.kind` ✓, `modifiers.kind` ✓,
      **new:** `buffers.type`, `energyTypes.type`, `unlockNodes.kind`, `structureBehaviors.kind`,
      `structures.drawKey` (`default|hidden|outline|drawnSprite` — `register/core/structures.ts`),
      `structures.buildModes[].type` (`BUILD_MODES`), `contacts.orientation`, `items.itemType`.
- [ ] Turn reference fields into `ref` controls with datalists sourced from the config itself:
      `unlockNode` → structures, `structureType` → structures, `processId` → processes,
      `elementId`/`inputA`/`inputB`/`output*`/`backgroundElementType`/`fogElementType` → elements,
      `cellType` → terrains, `sprite.id` → sprites, `categoryId` → upgradeCategories, `itemId` → items,
      `options.energyType` → energyNetworks.
- [ ] Make the label always reveal the register key (preferred format `Label · key`); today
      `Handler / process` hides which of `handlerKey` / `processId` the register step reads.
- [ ] Add numeric constraints: `chance` 0-1, `intervalMs` min 1, terrain `materialId` 101-149
      (the host throws otherwise — `register/core/terrains.ts` L104-114), `density` 0-1000, `hp` ≥ 0,
      `sequentialRuns` ≥ 1, `maxLevel` ≥ 1, `order` integer.
- [ ] Mark required exactly as the register requires — `elements.id/matterType/density`,
      `structures.id/unlockNode`, `contacts.inputA/inputB`, `energyTypes.structureId/type`,
      `excavationProfiles.power/pattern`, `placementConfigs.fields`, `items.sprite.id`,
      `unlockNodes.kind`, `structureBehaviors.kind`, `upgrades.itemId/categoryId` — and **block Save**
      while they are empty.
- [ ] id validation with the mod's rule (`^[a-z0-9][a-z0-9._-]{0,62}$`, `ui/definition/fields.ts`) and
      the same message, so a docs draft loads in-game without renames; keep the rename warning.
- [ ] Kill remaining ambiguous phrasings: `items.type` "Type alias", `Handler key` vs
      `Handler / process id`, `energyTypes` "Network", `structures` "Background (JSON)",
      `triggers` "Extra (JSON)", `structureBehaviors` "Behavior (JSON)".
- [ ] Grep gate: `grep -n '"json"' js/schema.js` must return **0** hits inside `FIELDS`.

## Phase 8 — Doc mirror & verification

- [ ] `index.html` — update the field tables of every collection touched above (they are the human
      mirror of `FIELDS`; README §7 requires both to move together).
- [ ] `js/graph.js` — add/fix edges whose meaning changed:
      `signals`/`triggers`/`processing`/`upgrades` → `processes : processId`,
      verify `modifiers → processes` (`applyModifier` never reads `processId`),
      plus `interactions → elements`, `excavationProfiles → terrains`,
      `placementConfigs → structures`, `energyTypes → structures` / `→ energyNetworks`.
- [ ] `js/app.js` `ANCHOR_PAGE` + sidebar entries for any new `#c-*` / `#s-*` article.
- [ ] `README.md` — refresh the counts (collections, "no Free JSON" claim, editor behaviour notes).
- [ ] Verification run: `deno task serve` → click every nav item → open each collection → create, edit,
      save, re-open, export → round-trip equality and **zero** stringified JSON values → clean console.
- [ ] Cross-check against `md-my-hown-mod/src/ui/definition/core/*.ts` (the in-game panel still has 22
      `kind:"json"` fields — record divergences here, do **not** copy them into the docs forms).
- [ ] Tick every box above, then remove the "unchecked" wording from this file's header.

---

### Out of scope (tracked, not blocking)

- [ ] In-game panel (`md-my-hown-mod/src/ui/**`) still uses `kind:"json"` in 22 places — outside this
      workspace; referenced here only for parity checks.
- [ ] `programV2` is a docs-only alias of the `processes` store; keep it, but verify the three
      `menuId` variants (`prog-signal`, `prog-processing`, `prog-trigger`) render identical fields.

