### Known boundary

Item `hideFromBuildMenu` is **not** fixed by this, and cannot be: the engine exposes no
item-visibility behaviour, so it remains this mod's UI only.

---

## Phase 7 — the structure behaviour form was three fields and a lie

Reported as "the parameter list is not full when I pick a kind". It was, and the cause was two
separate defects.

- [x] **7.1** Find where the option list actually lives. Not in the docs — the worker handler is the
      only place they are read:

      ```js
      registerConveyorType: (env, type, options) => { … }
      ```

      Transcribed in full at the top of `ui/definition/core/behavior.ts`. The
      published `sandkit/api/structureBehaviors.d.ts` agrees field for field,
      which is a useful second witness but was **not** on its own sufficient:
      `api.conveyors.md` types the options as `any`.
- [x] **7.2** Fix the registration bug. `registerStructureBehavior` read
      `sandkit.api.structureBehaviors`, a namespace that **does not exist in the engine bundle**.
      The generated engine surface lists `conveyors.registerType` and `launchers.registerType`. So
      every entry took the "API missing" branch, warned, and registered nothing — a conveyor could
      be configured, listed and saved and still not exist in the game. Both layouts are now probed,
      grouped first, so a build that grows the documented namespace works unchanged.
- [x] **7.3** Add the six conveyor options the form never had: `transportOffset`, `velocity`,
      `maxTransportDistance`, `transportHeight`, `runWith`, `skipQueued`.
- [x] **7.4** Add the launcher's own three: `velocity` (a `[x, y]` tuple — the conveyor's is a
      `{x, y}` object under the same key), `softDropVelocity`, `runTickSharedBufferKey`.
- [x] **7.5** Drive the form from one option table instead of a hand-listed array plus a
      hand-written destructure. The two had to be kept in step and were not: the six conveyor
      options were in neither.
- [x] **7.6** Two engine facts that are not obvious and are now in the hints: the whole options
      object is stored only if **at least one** of the six keys is present, and `runWith` defaults
      to **right** — `'left'` goes left and everything else, including absent, goes right.
- [x] **7.7** Keep `skipQueued: false` expressible. The engine tests `=== undefined`, not falsiness,
      so `false` is itself a meaningful value — it is what makes the worker store the options object
      at all. A Yes/No control cannot represent it, so it is kept in the raw box rather than lifted
      and dropped. Both this and the writer's matching guard are needed: with either one removed the
      round trip starts inventing or losing the key, which the existing round-trip test caught.
- [x] **7.8** `runTickSharedBufferKey` is the one new free-text field, and it is exempt for a stated
      reason: a shared buffer is created by naming it in `api.shared.buffers.ensure(key)`, so there
      is no list of existing keys to offer and a picker would be a guess. The pickers audit requires
      that reason and would otherwise have rejected the field.
- [x] **7.9** Tests. `schema_roundtrip` gained coverage of every option by name, both velocity
      shapes, the three bool states, a `0` that must not be dropped, and a kind switch that must not
      leave the other kind's fields behind. A new `structure-behavior.test.ts` covers the wrapper:
      the split API, the grouped API, argument order, and a host with neither.

---

## Phase 8 — `flammable` and `collectable` were checkboxes, and objects

Reported as two element attributes with no detail behind them. They had no detail because they were
being written in a shape the engine throws away.

- [x] **8.1** Both are **objects** in the engine, not booleans. The scraped types say so
      (`ElementFlammable`, `ElementCollectable`) and the runtime agrees: - `flammable` —
      `if ("object" == typeof s) { … }`. A boolean passes the truthiness gate that made the element
      flammable and is then discarded, so it burns and never leaves a residue. - `collectable` — the
      main thread and every worker build the collector's table with
      `table.set(mod.elementType, collectable?.value)`. `true?.value` is `undefined`, so the element
      is never added and the collector walks past it. Vanilla gold is `{ value: 2 }`.
- [x] **8.2** The old round trip could not have carried either shape, so a hand-written
      `collectable: { value: 2 }` did not even survive a save. The `FLAGS` group is booleans end to
      end — `typeof e[k] === "boolean"` in, `setBool` out — and both keys are in `FORM_COVERED`, so
      the passthrough dropped them too. Both have a dedicated read/write now and are out of the
      group.
- [x] **8.3** Parent toggle reveals the attributes, which is the ask. `Flammable` gates the residue
      element, the output chance, the inherited-duration flag and the lifetime pair; `Collectable`
      gates the value.
- [x] **8.4** The toggle means _the key is present_, not _its sub-values are set_, because the
      engine's gate is truthiness: `flammable: {}` really does burn. So off writes nothing at all
      (`del`, not an empty object), and on with nothing filled in writes `{}`.
- [x] **8.5** Two engine details that are easy to guess wrong, now in the hints: `outputChance`
      defaults to **0.25**, not 1, and `collectable.value` is required rather than decorative — the
      guard is `!= null`, so `{}` looks configured and collects nothing. That case is blocked in
      `validate`.
- [x] **8.6** `duration` is `number | [min, max]` and the engine branches on `Array.isArray`, so it
      is a pair of controls rather than a JSON box, with the same half-filled rule `durationRandom`
      uses. A lone lifetime stays a bare number, not a one-element tuple.
- [x] **8.7** A saved `flammable: true` / `collectable: true` reads back as _on_. It never worked,
      but it is in hand-edited configs, and silently reporting it as off would be a second wrong
      answer to the same question.
- [x] **8.8** Tests: the gate wiring for both toggles, the three flammable states, a full object
      round trip, the legacy booleans, a `0` chance that must not be dropped, the
      lone-lifetime-is-a-number rule, and both validation rules. Mutation-tested — writing `{}` when
      off, a truthiness test on the chance, inventing a `0` value, dropping the legacy read, and a

---

## Phase 9 — the legacy layer, removed

Every saved-config migration in the mod, plus the dead engine-version probes, gone. The author
accepted that existing installs lose their handlers.

- [x] **9.1** `handlerKey` / `onUpgradeKey` → `actions`. `actionRefsOf` now reads the `actions`
      array alone, so a config on the old spelling is **no process** — an empty list, not a
      one-action process. The engine never saw that key, so showing the author a populated list
      would have shown a handler that does not run.
- [x] **9.2** `ACTIONS_COVERED` is `[ACTIONS_STORE_KEY]` and the `del(legacy)` loop is gone. The old
      spellings are deliberately **not** claimed, so the passthrough carries them through untouched:
      stripping a key nothing reads would delete an author's data over an edit that never looked at
      that field.
- [x] **9.3** `getOptionsKey` and the short-lived `actions` list → `option` for projectiles, the
      same way. `projectileOptionOf` reads one shape.
- [x] **9.4** `hiddenFromTheMenu` and the element `hidden` alias are gone, and with them the whole
      `HIDDEN_ALIASES` table. Those aliases had a **different polarity** from the live field, so
      honouring them was a second rule that could disagree with the first on one entry. Only
      `HIDDEN_FIELD` is read now.
- [x] **9.5** The engine-version probes: `getTypeFromId` is no longer called as a fallback for
      `getTypeById`, and the `@deprecated` `mode` field is gone from `ProcessingConfig`.
      `structureId` is no longer an alias for `structureType` in either the processing register or
      the recipe machine lookup.
- [x] **9.6** **A real bug fell out of this.** The input-binding path built its single-action ref by
      faking an entry — `actionRefsOf({ handlerKey: key })` — which only worked while that reader
      still consulted the pre-split key. With 9.1 done, every input binding resolved to nothing,
      `skipped` came back non-empty, and **every binding was dropped with a warning**. No test
      reached that path. The ref is now spelled out, and a new `the-rest.test.ts` drives the real
      register entry with a stub host and asserts the compiled pair arrives. Reverting the fix is
      caught.
- [x] **9.7** The item guard in `mysandkit` still strips `handlerKey` / `onUpgradeKey` before the
      engine sees them — but by name, not via the removed export. Without it a stale key would pass
      the passthrough and be handed to the engine as a field it has no meaning for. That regex is
      pinned by a test.
- [x] **9.8** The panel's own shape hints stopped naming keys nothing reads: `signals`, `triggers`,
      `upgrades`, `modifiers` and `upgradeCategories` now say `actions: [{key, options}]`, and
      `projectiles` says `option: {key, params}`. A hint that names a dead key is the same
      silent-failure trap as the field itself.
- [x] **9.9** `SLOT_LOCATION` lost its second tuple half. Nothing read it — the scan goes through
      `actionRefsOf` precisely so there is one reader — but a field name sitting there invited
      exactly the second path it was meant to prevent.
- [x] **9.10** Two things called legacy that were **live**, and were left alone: -
      `requirementTechId` is a working control, not a migration. It backs the upgrade-category tech
      picker and `relations.ts`. - `HandlerMeta.type` is what the Handlers tab filters on, pending
      the Phase 6 regroup. Removing either would break a working screen.
- [x] **9.11** `ModifierConfig.handlerKey` is **code-side** — a pointer into `CODE_HANDLERS` in
      `handlers.ts` — not a saved-config migration, so it stays. Note the gap it leaves: the panel
      writes a modifier's process as `actions`, while `applyModifier` reads `handlerKey`, so a
      modifier configured in the panel still cannot attach. That gap predates this phase and fixing
      it is a feature, not a removal.
- [x] **9.12** One thing fixed in passing, not part of the removal: the element list's `searchText`
      joined only the _values_ of its keys. `flammable` and `collectable` became objects in Phase 8,
      and `brief` on an object returns the one identifying value inside it — an element id, a number
      — so the words "flammable" and "collectable" stopped appearing in the searched text and "which
      of mine are flammable?" became unanswerable. The key name is now searched alongside its value.
      one-element tuple are all caught.
