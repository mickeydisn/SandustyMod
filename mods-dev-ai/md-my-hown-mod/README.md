# My Own Mod Configurator (`md-my-hown-mod`)

`md-my-hown-mod` · v0.1.0 · **dev**

In-game configurator to define and register **elements, structures, items, recipes, processing, contact reactions, and element interactions** via JSON stored in game storage. Movable minimizable panel (minimized by default, **no item required**).

## Full register coverage (sandkit v0.5.7)

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
| `alwaysUnlocked` / `unlockedBy` / `hideFromBuildMenu` / `disallowPick` | |
| `blockGridType` | alias |
| `shape` | `number[][]` (1 = occupied) |
| `buildModes` | `{ type: single\|line\|rectangle\|…, directions? }[]` |
| `variants` | `{ id, angles: number[] }[]` |
| `render` | `imageName`, `size`, `offset`, `ui`, `spritesheet.frameBuffer` |
| `defaultData` / `copyData` | instance data |
| `rejectWhenBlocked` / `altOriginOffsetY` / `tooltipHover` | |
| `draw` | function — **not JSON-serialisable** |
| `registerOptions.useRawShape` | second arg to register |

Also: `structures.recipes.register`, `structures.processing.register`, `structures.addProcessor`, `structures.addVariant`.

### Items — `api.items.register`

| Field | Notes |
| --- | --- |
| `id` | required |
| `itemType` / `type` | Weapon \| Tool \| Consumable \| Mod |
| `name` / `nameKey` / `description` / `descriptionKey` / `categoryKey` | |
| `sprite` | **required** by engine: `{ id, type?: onehand\|twohand\|backhand, mount? }` |
| `cooldown` | number or object |

### Recipes — `processing.register*` + `structures.recipes.register`

| Field | Notes |
| --- | --- |
| `kind` | grower \| planterBox \| shaker \| kineticPress \| condenser \| steamDryer \| synthesizer \| snowmaker \| smelter \| structure |
| `structureType` | target when kind is structure / custom |
| `input` / `output` / `chance` | element refs + probability |
| `outputs` / `outputsAbove` / `outputsBelow` | `[{ elementType, chance? }]` |
| `minimumDownwardVelocity` | kinetic press gate |

### Processing — `structures.processing.register` / `addProcessor`

| Field | Notes |
| --- | --- |
| `structureType` / `structureId` | type vs instance |
| `intervalMs` | tick interval |
| `mode` | `type` \| `instance` |
| `process` | **callback — cannot be stored in JSON**; attach in code |

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
  deno.json  README.md
  src/
    modinfo.json  constants.ts  main.ts
    config/store.ts
    register/apply.ts
    ui/panel.ts  styles.ts
    packages/modkit.ts  mysandkit.ts
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
  "interactions": []
}
```

Prefer the **JSON tab** for nested fields (`shape`, `colors`, `outputs`, full structure `render`). The form covers the common scalar fields.

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

## Extended content categories (full configurator surface)

| Config key | API |
| --- | --- |
| `terrains` | `terrains.register` |
| `techs` | `tech.registerDefinition` (+ optional `registerNode` via `parentId`) |
| `upgradeCategories` / `upgrades` | `upgrades.registerCategory` / `register` |
| `projectiles` | `projectiles.register` (`getOptions` from static `options` or `getOptionsKey`) |
| `energyTypes` | `energy.registerType(structureId, type, options)` |
| `excavationProfiles` | `excavation.registerProfile(id, {power, pattern, options})` |
| `structureBehaviors` | `structureBehaviors` (conveyor/launcher best-effort) |
| `signals` | `signals.targets/interactables/registerSenderType` + `handlerKey` |
| `triggers` | `triggers.register` + `handlerKey` |
| `sprites` | `sprites.loadFromMod` / `load` (**applied first**) |
| `modifiers` | `hooks.intercept` / `modify` + `handlerKey` |

Callback-backed entries (`signals`, `triggers`, `modifiers`, projectile `getOptions`, upgrade `onUpgrade`) use **`handlerKey`** → `src/hooks/handlers.ts` (`CODE_HANDLERS` / `ANY_HANDLERS`). Prefer the **JSON tab** for nested definitions.
