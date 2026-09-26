# My Own Mod Configurator (`md-my-hown-mod`)

`md-my-hown-mod` · v0.1.0 · **dev**

In-game configurator to define and register game content via JSON stored in game
storage. Movable minimizable panel (minimized by default, **no item
required**).

## Documentation

| | |
|---|---|
| **[`doc/REFERENCE.md`](doc/REFERENCE.md)** | every form field → the config key it stores → whether the engine reads it. **Generated.** |
| **[`doc/KNOWN-ISSUES.md`](doc/KNOWN-ISSUES.md)** | engine behaviours that contradict the obvious reading, and fields the shipped typings omit. **Generated.** |
| [`src/types/engine-api.generated.d.ts`](src/types/engine-api.generated.d.ts) | the api surface, derived from the shipped bundle. **Generated.** |
| [`doc-bundel/PLAN.md`](doc-bundel/PLAN.md) | the seven-phase audit that produced all of the above |

The generated files come from the same artefacts the audit built, so they
cannot drift from the code. Regenerate with:

```sh
deno run -A tools/gen-reference.ts
```

## Coverage

All **36** config-reachable api members are wrapped — `elements`, `structures`,
`items`, `recipes`, `processing`, contacts, interactions, terrains, techs,
upgrade categories, upgrades, projectiles, energy types, excavation profiles,
conveyor/launcher behaviours, signals, triggers, sprites, modifiers, and input
bindings. A capability map of all 300 public members (registerable, queryable,
runtime, internal) is in [`doc-bundel/CAPABILITY-MAP.md`](doc-bundel/CAPABILITY-MAP.md).

### Tabs

`elements` · `structures` · `items` · `recipes` · `processing` · `contacts` ·
`interactions` · `terrains` · `techs` · `categories` · `upgrades` · `signals` ·
`triggers` · `behaviors` · `energy` · `excavation` · `projectiles` · `sprites` ·
`modifiers` · `inputs` · `handlers` · `json`

## Register coverage

### Elements — `api.elements.register`

| Field | Notes |
| --- | --- |
| `id` | required string |
| `name` / `nameKey` | display name / i18n |
| `description` / `descriptionKey` | tooltip |
| `matterType` | Solid=1 Liquid=2 Particle=3 Gas=4 Static=5 Slushy=6 Wisp=7 Powder=8 |
| `density` | sink/float |
| `metaColor` | packed RGB int |
| `materialId` | material link |
| `colors` | `{ variants: [[r,g,b,a],…] }` or raw array |
| `colors.variantFromDataField1` | `{ rangeMin, rangeMax, invert, useGradient }` |
| `duration` / `durationRandom` | transient lifetime |
| `flammable` | bool or object |
| `isGrabbable` / `isTransportable` / `hidden` | flags |
| `interactions` | array of descriptors |
| `defaultDataFields` | initial per-cell data |
| `getExtraProps` | function — **not JSON-serialisable** |

Also: `elements.updateDefinition`, `elements.addInteractionInfo` (via **interactions** category).

### Structures — `api.structures.register`

| Field | Notes |
| --- | --- |
| `id` | required |
| `name` / `nameKey` / `description` / `descriptionKey` | |
| `categoryKey` | blocks, logistics, production, economy, logic, fluids, lighting, special, misc, thermal |
| `order` | sort in category |
| `alwaysUnlocked` / `hideFromBuildMenu` / `disallowPick` | build-menu visibility |
| _(no `unlockedBy`)_ | unlock a structure from a **tech node**: `unlocks.structures` or `tech.conservatory.appendUnlock` |
| `blockGridType` | alias |
| `shape` | `number[][]` (1 = occupied) |
| `buildModes` | `{ type: single\|line\|rectangle\|…, directions? }[]` |
| `variants` | `{ id, angles: number[] }[]` |
| `render` | `imageName`, `size`, `offset`, `ui`, `spritesheet.frameBuffer` |
| `defaultData` / `copyData` | instance data |
| `rejectWhenBlocked` / `altOriginOffsetY` / `tooltipHover` | |
| `draw` | function — **not JSON-serialisable** |
| `registerOptions.useRawShape` | second arg to register |

Also: `structures.recipes.register`, `structures.processing.register`, `structures.addVariant`.
There is **no `structures.addProcessor`** — processors are always registered by
structure *type*.

### Items — `api.items.register`

| Field | Notes |
| --- | --- |
| `id` | required |
| `itemType` / `type` | Weapon \| Tool \| Consumable \| Mod |
| `name` / `nameKey` / `description` / `descriptionKey` / `categoryKey` | |
| `sprite` | **required** by engine: `{ id, type?: onehand\|twohand\|backhand, mount? }` |
| `cooldown` | number or object |
| `excavationProfileId` | **Tool** only — what it digs with |
| `projectileId` | **Weapon** only — spawned via `projectiles.createBlueprintFromId` |
| `handlerKey` | becomes `ItemDefinition.handleAction`; see **Handlers** below |

There is **no** `projectileType` / `reloadType` field: `ProjectileDefinition` is
only `id`, `sprite`, `getOptions`, `getModData`, and a projectile's behaviour
comes entirely from `getOptions()`.

#### Use actions

`itemType` only labels the hotbar slot — the *behaviour* is
`ItemDefinition.handleAction`, which the engine calls with an **`ActionType`**.
`ActionType` is `Weapon|Building|Tool|Mod`; it has **no `Consumable`**, so a
consumable has no use action to dispatch and is deliberately metadata-only. The
*Use action* picker therefore follows the item type:

| `itemType` | `ActionType` | Offered actions |
| --- | --- | --- |
| `Tool` | `Tool` | `itemExcavate`, `excavationDefault/Crusher/Drill/Gun/Shatter`, `noop` |
| `Weapon` | `Weapon` | `itemShoot`, `noop` |
| `Mod` | `Mod` | `itemDefault`, `noop` |
| `Consumable` | *(none)* | — none, and none may be stored |

### Recipes — `processing.register*` + `structures.recipes.register`

| Field | Notes |
| --- | --- |
| `kind` | grower \| planterBox \| shaker \| kineticPress \| condenser \| steamDryer \| synthesizer \| snowmaker \| smelter \| structure |
| `structureType` | target when kind is structure / custom |
| `input` / `output` / `chance` | element refs + probability |
| `outputs` / `outputsAbove` / `outputsBelow` | `[{ elementType, chance? }]` |
| `minimumDownwardVelocity` | kinetic press gate |

### Processing — `api.structures.processing.register(id, definition)`

| Field | Notes |
| --- | --- |
| `structureType` | structure **type** — the callback runs for every placed instance |
| `intervalMs` | tick interval, must be > 0 |
| `process` | **callback — cannot be stored in JSON**; attach in code |

The `StructureProcessingContext` handed to `process` exposes
`getResolvedTypeAtCell(x, y)`, `isCellEmptyAtCell(x, y)` and
`commit(mutations)`. Note `commit` takes a **single** mutations payload, not
`(x, y, type)`.

There is no "single instance" mode: the engine keys processors by structure type.

### Contact reactions — `reactions.registerContact`

| Field | Notes |
| --- | --- |
| `inputA` / `inputB` | element ids/types |
| `outputA` / `outputB` | element or `null` to consume |
| `orientation` | optional constraint |

### Interactions — `elements.addInteractionInfo`

| Field | Notes |
| --- | --- |
| `elementId` | target element |
| `interaction` | descriptor object (`kind` + payload) |

## Layout

```
md-my-hown-mod/
  deno.json  README.md  PLAN.md
  doc/                       generated reference + known issues
  doc-bundel/                the audit: plan, phases, artefacts
  tools/                     the generators and the audit checks
  src/
    main.ts  constants.ts    config types + defaults
    api.ts
    catalog.ts               enum / id / handler pickers
    config/store.ts          load, migrate, save
    register/apply.ts        config -> api calls
    hooks/                   intercept / modify + handlers
    packages/modkit.ts  mysandkit.ts
    ui/panel.ts  schema.ts  styles.ts  handlers-panel.ts
    types/engine-api.generated.d.ts
```

## Config shape

```json
{
  "version": 1,
  "elements": [{ "id": "md-my-hown-mod:dust", "name": "Dust", "matterType": "Powder", "density": 1.1, "metaColor": 14540253, "colors": { "variants": [[200,180,160,255]] } }],
  "structures": [{ "id": "md-my-hown-mod:block", "name": "Block", "categoryKey": "blocks", "shape": [[1,1],[1,1]] }],
  "items": [{ "id": "md-my-hown-mod:tool", "name": "Tool", "itemType": "Tool", "sprite": { "id": "…", "type": "onehand" } }],
  "recipes": [{ "id": "…", "kind": "shaker", "input": "sand", "output": "md-my-hown-mod:dust", "chance": 0.8 }],
  "processing": [],
  "contacts": [{ "id": "…", "inputA": "water", "inputB": "lava", "outputA": "steam", "outputB": null }],
  "interactions": [],
  "upgradeCategories": [{ "id": "tools", "name": "Tools" }],
  "inputBindings": [{ "id": "ToggleMode", "displayName": "Toggle mode", "category": "Mod controls", "defaultKeys": ["Control+KeyC"] }]
}
```

The **JSON tab** remains the escape hatch: every tab has an `advancedJson` box,
and anything the form does not own round-trips through it verbatim. But nested
values no longer *require* raw JSON — `shape`, `colors`, `outputs`, upgrade
`costs`, excavation patterns, hover tooltips and the `render` block all have
structured editors. See [`doc/REFERENCE.md`](doc/REFERENCE.md) for the
field-by-field map.

## Limits

- **Functions** (`draw`, `process`, `getExtraProps`) cannot live in JSON storage — register those from code extensions.
- **Sprites** must be loaded (`api.sprites.loadFromMod`) before item/structure render works; placeholder sprite ids are used so register does not throw.
- Session-idempotent registration (same id not re-registered in one boot).

## Modifiers / hooks (`hooks.intercept` + `hooks.modify`)

JSON cannot store real functions. This mod splits **metadata (JSON)** from **callbacks (code)**:

### 1. Config entry (storage / UI tab **modifiers**)

```json
{
  "id": "md-my-hown-mod:log-probe",
  "hookId": "someEngineHookName",
  "kind": "intercept",
  "handlerKey": "logArgs",
  "options": {},
  "enabled": true,
  "notes": "Probe while discovering real hook ids"
}
```

| Field | Meaning |
| --- | --- |
| `hookId` | Engine hook point name (string; official list is incomplete) |
| `kind` | `intercept` (observe) or `modify` (transform return value) |
| `handlerKey` | Key in `src/hooks/handlers.ts` → `CODE_HANDLERS` |
| `options` | 3rd argument to `hooks.intercept` / `hooks.modify` |
| `enabled` | Skip attach when `false` |

Without `handlerKey`, the entry is **stored only** (not attached).

### 2. Code handlers (`src/hooks/handlers.ts`)

```ts
export const CODE_HANDLERS = {
  logArgs: {
    kind: "intercept",
    fn: (args, ctx) => console.log("intercept", args, ctx),
  },
  identity: {
    kind: "modify",
    fn: (args) => args,
  },
};
```

Add your own keys here, set `handlerKey` in JSON, hit **Apply to game**.

### 3. Apply path

`register/apply.ts` → `hooks/apply.ts` → `api.hooks.intercept|modify`.  
Teardown / disable calls `detachAllModifiers()`.

Built-in probe keys: `logArgs`, `identity`, `logBuildingPayload`.

### Energy — `api.energy.registerType`

`registerType(structureId, type, options?)` accepts **exactly two roles**:

| `type` | Meaning |
| --- | --- |
| `storage` | holds energy; set `options.capacity` |
| `conductor` | forwards energy, holds nothing |

There is **no `producer` / `consumer` role**. Generating or drawing energy is
done by a *processor* handler calling `api.energy.addAtCell(x, y, amount)` or
`api.energy.consume(amount)`.

### Upgrades — `api.upgrades.register`

The payload is **nested** under `upgrade`:

```ts
api.upgrades.register({
  itemId: "myMod.wrench",
  categoryId: "tools",
  upgrade: { id: "lvl2", maxLevel: 3, costs: [100, 250, 500], oneOff: false },
});
```

Read the level back with `api.upgrades.getLevelById(itemId, upgradeId)` and set it
with `setLevelById`. There is no `upgrades.apply`.

### Tech — `api.tech`

| Call | Purpose |
| --- | --- |
| `registerDefinition(techId, def)` | define a tech (`name`, `cost`, `currencyType`, `branch`, `description`, `requires`, `unlocks`) |
| `registerNode(techId, def, { parentId, preferredPosition? })` | place it on the grid |
| `conservatory.appendUnlock(techId, { structures?, items? })` | append unlocks to a node |

There is **no `api.tech.unlock`** — use the declarative `unlocks` field or
`conservatory.appendUnlock`.

## Extended content categories (full configurator surface)

| Config key | API |
| --- | --- |
| `terrains` | `terrains.register` |
| `techs` | `tech.registerDefinition` (+ optional `registerNode` via `parentId`) |
| `upgradeCategories` / `upgrades` | `upgrades.registerCategory` / `register` |
| `projectiles` | `projectiles.register` (`getOptions` from static `options` or `getOptionsKey`) |
| `energyTypes` | `energy.registerType(structureId, 'conductor' \| 'storage', options)` — options: `capacity`, `energyType` |
| `excavationProfiles` | `excavation.registerProfile(id, {power, pattern, options, terrainRules})` |
| `structureBehaviors` | `structureBehaviors` (conveyor/launcher best-effort) |
| `signals` | `signals.targets/interactables/registerSenderType` + `handlerKey` |
| `triggers` | `triggers.register` + `handlerKey` |
| `sprites` | `sprites.loadFromMod` / `load` (**applied first**) |
| `modifiers` | `hooks.intercept` / `modify` + `handlerKey` |

Callback-backed entries (`signals`, `triggers`, `modifiers`, projectile `getOptions`, upgrade `onUpgrade`, item `handleAction`) use **`handlerKey`** → `src/hooks/handlers.ts` (`CODE_HANDLERS` / `ANY_HANDLERS` / `PROCESS_HANDLERS`). Prefer the **JSON tab** for nested definitions.

### Handlers

**Assets & hooks → Handlers** is a registry browser, not a CRUD list: a handler
is code, so the tab groups all 47 callables by **type**
(`global | cell | message | tech | processor | projectile | modifier`), documents
each, shows its **scope** and **slots**, lists where it is already used, and
emits a copyable JSON snippet. The data lives in
`src/hooks/handler-registry.ts`, which is the single source of truth for both the
tab and every per-slot picker — so a handler can never be offered in a slot it
cannot serve, and a stored reference that *is* illegal is listed in red at the
top of the tab rather than failing silently in-game.
