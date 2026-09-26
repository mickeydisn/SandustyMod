# md-my-hown-mod — rework plan

Everything below was checked against the **shipped engine source**
(`__bundel/modules/bundel.js/46781.js`), not the typings alone. Where a field
was suspected of not existing, the finding is recorded in the item so the next
reader does not repeat the search.

Legend: `[ ]` todo · `[x]` done

**Progress: sections 1, 2, 3, 6 and 7 are done** — 530 mod tests + 192 tool
tests, clean typecheck, 318 KB. Sections 4, 5, 8 and 9 are still open; each
carries a note saying what is left and why.

---

## 0. Ground truth established while planning

| field | what the engine actually does |
|---|---|
| `linkedClearance` | Minified to `structureConfig.n`. The **only** comparison is `=== "allOrNothing"`. Anything else skips the all-or-nothing check. A two-state switch, not free text. |
| `buildModes` | `Array.isArray(e) && e.forEach(rt)` — a **list**. `rt` throws `spanTiles` unless `type === "line"`. Multiple modes are legal. |
| `blockGridType` | `registerStructureType(blockGridType ?? id)`, then if it differs from `id`, `registerStructureTypeAlias(id, blockGridType)`. It **is** real: it names the block grid, and a different value shares one grid. |
| `draw` | `T(structureId, drawFn)` into a per-type map. At render: `if (fn && fn(session, instance, {tilemap, ctx, useTilemap, placing, opts}) !== false) return;` — a **function**. Returning `false` falls through to the normal sprite render. |
| `defaultData` | `JSON.parse(JSON.stringify(...))` at register, then `instance.data = clone` on placement. The **per-instance data object**, unrelated to elements. |
| `terrains.materialId` | `obstacleBreakpoint` is `100` (`utils-worker.js/90823.js`). Valid range **101–149**; outside that the engine throws. |
| `tech.requires` | `readonly string[]` — an array of tech ids. |
| upgrade category `requirement` | `mods.upgradeCategories[id] = {…, requirement}`. Grepped the whole repo: **nothing ever reads it back.** Stored verbatim, never used. |
| element `interactions` | Discriminated union on `kind`: `destroyer \| structure \| entity \| flammable \| meltable \| freezable \| custom`. |

---

## 1. Menu structure

- [x] **Remove the `World` group.** Its only member, `terrains`, moves to
      `Content` — terrain *is* content, and a one-tab group is not a group.
- [x] **Split `Assets & hooks`** into `Assets` (sprites), `Handlers`, `Hooks`
      (modifiers). Unrelated things sharing a bucket.
- [x] `Content` becomes: Elements, Structures, Items, Terrains.
- [x] Update `screens.test.ts` and any group-name assertions.

## 2. Free strings → real pickers

> Rule for this pass: **no free text where the value is a closed set.**

- [x] **`linkedClearance` → select.** Two states: `Per cell (default)` /
      `All or nothing`. A typo today reads as `undefined` → per-cell, silently.
- [x] **`terrain.materialId` → select** of meaningful ids, not free-typed
      `1–149`. Engine throws outside 101–149.
- [x] **`tech.requires` never falls back to a text box.** Show an empty state
      explaining that other techs are needed first.
- [x] Audit every `multiselect` for the same free-text fallback and remove it.

## 3. Structure fields that were wrong or missing

- [x] **`buildModes` → a real repeating list** of `{type, spanTiles}`. The form
      held only one, so a two-mode structure silently lost one. `spanTiles` is
      valid on `line` only (engine throws otherwise).
- [x] **`blockGridType` → a select of structures**, labelled "share block grid
      with", with the aliasing spelled out.
- [x] **`draw` → a built-in-function picker**, like the handler pickers. It is a
      callback and cannot be JSON, so ship ready-made draw functions.
- [x] **`defaultData` → relabel and explain.** It seeds each placed instance and
      `tooltipHover` reads it back via `dataField1..4`.


## 4. `Production → Element ↔ structure` (the "poor" panel)

- [ ] Rebuild around the `kind` union: a `kind` select, then only the fields
      that kind has. Today it is one free JSON box.
- [ ] `structure` kind → `structures` multi-select + tooltip metadata
      (`textKey`, `visibleWhen`, `crossedOutWhen`, `onlyWhenTranslated`).
- [ ] Flag-only kinds (`flammable`, `meltable`, `freezable`) need no fields —
      say so instead of showing an empty editor.
- [ ] Plain-language intro: this is what the tooltip shows when a tool is held
      over the element.

## 5. Element appearance

- [x] **Colour variants become a picker/list**, not `[[r,g,b,a], …]` in JSON.
- [x] **The first variant defaults to the map colour**, so setting `metaColor`
      alone already looks right.
- [x] Hint explaining a variant is a random per-cell tint.

## 6. Advanced fields

- [x] **List the field names being preserved**, with a count and their origin.
- [x] **Render nothing when there are no such fields.** An empty JSON box
      invites the user to type something merged on top of real fields.
- [x] Same for every other panel showing the box.
- [ ] Keep the round trip lossless — still the escape hatch for unmodelled
      engine fields.

## 7. Help → graph only

- [x] **Remove the text documentation.** Field tables and prose duplicate the
      engine docs; the one thing not lookable elsewhere is what points at what.
- [x] Help keeps the relation table and the graph.
- [x] **Fill in the missing relations.** Confirmed gaps: `recipes.input` /
      `outputs` / `outputsAbove` / `outputsBelow`,
      `terrains.excavationRequirements`, `terrains.interactions`,
      `items.excavationProfileId`, `items.projectileId`, `items.sprite`,
      `structures.imageName`, `structures.variants`, `structures.blockGridType`,
      `techs.requires`, plus handler-key edges.
- [x] Make `relations.test.ts` fail when a **new** reference field is added
      without a relation, so the graph cannot rot again.

## 8. Upgrade category `requirement`

- [ ] Replace the free JSON box. It is stored and never read, so the UI must say
      that rather than imply it does something.
- [ ] Offer the most plausible shape (a tech id) as a select, labelled as a
      pass-through; keep the advanced box for anything else.

## 9. Tooltip (hover) clarity

- [ ] `tooltipHover` is a raw JSON object. Give it a structured editor, or at
      minimum show the documented example as a placeholder and explain that it
      reads `defaultData`.

## Cross-cutting

- [x] `deno check src/main.ts`, `deno test -A`, `deno task build:main` green
- [x] Every bundle-derived claim recorded in `doc/KNOWN-ISSUES.md`
