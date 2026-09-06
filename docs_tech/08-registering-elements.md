# Registering New Elements & Reactions — the `register` config object

This is the reference for **defining new element types** from `main`, wiring
**element↔element reactions**, and **element↔structure interactions** — exactly
what `api.elements.register`, `api.reactions.registerContact`, and
`api.discoveries` do.

> All verified against the bundles. The engine keeps every mod-defined element
> definition object **verbatim** in `sandkit.mods.elements[id]`, and the worker
> stores it as-is into the config table `m5[elementType] = def`
> (`zH`, bundel-worker.js:45837-45838). So **the config object you pass is the
> schema** — whatever fields you set are what every subsystem reads.

---

## 1. `api.elements.register(def)` — define a new element

**Signature (main-thread):** `register(def) => { elementType: number }`
Source: bundel.js:51070-51096, worker store `zH` (45837).

The single argument is the **element definition object**. Fields the engine
actually reads (gathered from the built-in config table, bundel-worker.js:
46448-46925, the register processing, and the mod usage below):

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | `string` | ✅ | unique element id. Also the key under `sandkit.mods.elements[id]`. |
| `nameKey` | `string` | ✅* | i18n key → display name (register it with `api.i18n.register`) |
| `descriptionKey` | `string` | – | i18n key → tooltip/description |
| `colors` | `{ variants: [r,g,b][] }` | – | per-variant RGB arrays for the sprite |
| `metaColor` | `int` (0xRRGGBB) | – | map/inspector colour (packed) |
| `density` | `number` | ✅ | displacement/sink weight (see `06`) |
| `matterType` | `int` | ✅ | Solid/Liquid/Gas/Powder/Slushy/Static/Wisp/Particle (`sandkit.enums.MatterType`) |
| `interactions` | `Interaction[]` | – | element↔**structure** interactions (see §4) |
| `duration` | `number` | – | default lifetime (seconds) |
| `durationRandom` | `{ min, max }` | – | random lifetime range |
| `data` | `object` | – | static extra data copied onto instances |
| `getExtraProps` | `fn(e, state)` | – | build per-instance extra props at spawn |
| `defaultDataFields` | `{ field1..field4 }` | – | initial per-instance data fields |
| `horizontalSpeed` | `number` | – | lateral spread speed |
| `isTransportable` | `boolean` | – | can be moved by conveyor/collector |
| `materialId` | `string` | – | links element to a material def |
| `update` | `fn` | – | override the matter update for this type |

You do **not** set `elementType` — the engine assigns the next free type number
(`maxRegistered + 1`, bundel.js:51071-51078) and returns it. `isTypeAtCell`,
`getTypeFromId`, `getDefinitionByType` resolve it afterwards.

### Minimal working example (from the Astro Seeds mod)

```ts
const MatterType = sandkit.enums?.MatterType ?? {};
const MT_POWDER  = MatterType.Powder ?? 8;

// 1) register the display text for the nameKey
sandkit.api.i18n.register("en", {
  "astro.seeds:mote|name":        "Mote",
  "astro.seeds:mote|description": "A custom powder mote.",
});

// 2) register the element; keep the returned type number
const { elementType: mote } = sandkit.api.elements.register({
  id: "astro.seeds:mote",
  nameKey: "astro.seeds:mote|name",
  descriptionKey: "astro.seeds:mote|description",
  colors: {
    variants: [
      [180, 220, 255],
      [140, 190, 255],
      [100, 160, 240],
    ],
  },
  density: 150,          // heavier than water(100), lighter than gold(300)
  metaColor: 0x8ec8ff,   // packed RGB
  matterType: MT_POWDER,
});
```

Returns `{ elementType: mote }` — cache this number and share it with the worker
(i.e. via a required shared buffer) so the worker can `getTypeFromId` / test
`isTypeAtCell` without re-registering.

### What `register` does internally
1. Computes a fresh type id: `max(builtInMax, modMax) + 1` (bundel.js:51071).
2. Stores the def in `sandkit.mods.elements[id]` and calls `zH(def, type)`
   which puts it in the engine config store `m5[type]` (bundel-worker 45837).
3. Applies `colors` to the session colour scheme, sets `metaColor`.
4. Returns `{ elementType }` (bundel.js:51093).

### Editing a type later
- `api.elements.updateDefinition(idOrType, patch)` merges fields into an existing
  config (bundel.js:51098-51116).
- `api.elements.addInteractionInfo(typeOrId, interaction)` appends to a type's
  `interactions` array (bundel.js:51118-51127).
---

## 2. `api.discoveries.*` — unlock in the "?" catalogue

| Method (mod-facing) | Engine | Purpose | Source |
|---|---|---|---|
| `addElementByType(t)` | `discoveries.addElement(e, t)` | reveal an element in the discoveries catalogue | bundel.js:54248-54256 |
| `addElement(t)` | alias | same as above | bundel.js:54248 |
| `addTerrain(t)` | `discoveries.addTerrain(e, t)` | reveal a terrain | bundel.js:54257 |

Call **after** `register`, with the returned `elementType`:

```ts
sandkit.api.discoveries.addElementByType(mote);   // it now appears in the "?" menu
```

> Both the engine's `addElement` and the mod-facing `addElementByType` refer to
> the same catalogue — the engine stores the id in `e.store.discoveries.elements`
> (dedup) so a type is only added once.

---

## 3. `api.reactions.registerContact(opts)` — element ↔ element reaction

**Signature (main-thread):** `registerContact(opts) => void`
Source: bundel.js:52439 (`Me.Aw`).

Turns two touching elements into two outputs. **This is for ELEMENT↔ELEMENT
reactions.** For element↔**structure** interactions use the `interactions:` array
on the element def instead (see §4).

### The `opts` object

| Field | Type | Meaning |
|---|---|---|
| `inputA` | `ElementType` | reaction A (must be non-null) |
| `inputB` | `ElementType` | reaction B (must be non-null) |
| `outputA` | `ElementType \| null` | replaces `inputA`; `null` = remove it |
| `outputB` | `ElementType \| null` | replaces `inputB`; `null` = remove it |

```ts
// seed + voidPetal → voidSeed (petal consumed)
sandkit.api.reactions.registerContact({
  inputA: seedBase,
  inputB: voidPetalType,
  outputA: voidSeed,
  outputB: null,
});

// goldCrystal + fire → gold, and the fire stays
sandkit.api.reactions.registerContact({
  inputA: goldCrystal,
  inputB: fireType,
  outputA: goldType,
  outputB: fireType,
});
```

Resolve every type with `getTypeFromId(id)` first and skip the call if any is
`null` (the astro mod does exactly this, main.ts:180-224).

---

## 4. Element ↔ **structure** interactions — the `interactions:` array

To make a new element react with an **existing structure** (Collector, Smelter,
Grower, VelocitySoaker, …) you configure the element's `interactions` at register
time — not `registerContact`. The built-in elements wire these with small builder
callbacks on their def (bundel-worker `fe` table, e.g. `J.QK(r.ev.Collector)` for
the Collector, `J.QK(r.ev.Grower)` for Grower contact, `J.NP()`, `J.G()`,
`J.vc()`).

**Reachable additive API for mods:** `api.elements.addInteractionInfo(type,
interaction)` (bundel.js:51118-51127) appends an interaction object to a type's
`interactions` list:

```ts
sandkit.api.elements.addInteractionInfo(mote, {
  // interaction object read by the structure's processor
  // (shape is defined per-structure)
});
```

> ⚠️ The interaction builders (`J.QK`, `J.NP`, …) are **internal module
> functions and are not exposed through `sandkit.api`** — they only appear inside
> the bundled element definitions. The exact shape of a usable interaction object
> for a given structure is defined by that structure's processor, so verify
> against the structure's behaviour before relying on it.

---

## Summary — which tool for which case

- New element that should exist → `api.elements.register`.
- Show it in the "?" catalogue → `api.discoveries.addElementByType`.
- Element **+ Element** → two outputs → `api.reactions.registerContact`.
- Element + **Structure** (belt, collector, grower…) → element-level
  `interactions:` (or `addInteractionInfo`).
`getTypeFromId`, `getDefinitionByType` resolve it afterwards.