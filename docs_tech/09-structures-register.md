# `api.structures.register(def)` — Defining Structures & Buildings

Reference for **registering a new structure / building** from `main` via
`sandkit.api.structures.register(def)`. This is the config object used by the
`buffer-controls` / `sandustry-icons` mods (`mods/*/src/register.ts`)and by every
built-in structure in the engine.

> All behavior verified against the bundles. The engine keeps the definition you
> pass **verbatim** (minus a few normalizations listed in §3) in both
> `sandkit.mods.structures[id]` and the internal table `A.VI[id]`, so every
> subsystem (build menu, placement, rendering, copier) reads the **same
> object** you supplied (bundel.js:52556-52557, worker bundel-worker.js:35140).

> Source: `__bundel/bundel.js` — `structures.register` body at **lines 52541-52565**.

---

## 1. Signature

```ts
// mod-facing (single arg — the mod context is injected for you)
sandkit.api.structures.register(def: StructureDefinition): void;

// internal engine signature (state/env is the first arg)
register(e, def, opts?) : void          // bundel.js:52541
```

The optional (internal) third argument only carries one flag today:

| opt | Type | Meaning |
|---|---|---|
| `opts.useRawShape` | `boolean` | when `true`,the `shape` array is used **as-is** instead of normalizing cells. Undefined/`false` = normalize (`1` → Block, `0`/other → Empty). |

From a mod you almost always call it with just the definition object.



## 2. The definition object — top-level options

Everything below is read straight off the object you pass. This table is the
**authoritative** field list, gathered from the register processing (52541-52565),
the built-in structure table (2920-3230)and the consumers listed in §4.,

| Field | Type | Req. | Meaning / where consumed |
|---|---|---|---|
| `id` | `string` | ✅ | unique structure type id. Key under `sandkit.mods.structures[id]` and `A.VI[id]`. |
| `name` | `string` | – | display name in the build menu / picker. Used when no `nameKey`. |
| `nameKey` | `string` | – | i18n key → display name (preferred over `name`). |
| `description` | `string` | – | tooltip description text. |
| `descriptionKey` | `string` | – | i18n key → tooltip description. |
| `categoryKey` | `string` | ✅* | build-menu category. Existing values: `"blocks"`, `"logistics"`, `"production"`, `"economy"`, `"logic"`, `"fluids"`, `"lighting"`, `"special"`, `"misc"`. |
| `order` | `number` | – | sort position within its category (vanilla uses 10/20/30/40/50/…). |
| `alwaysUnlocked` | `boolean` | – | available without unlocking (build-menu gate, 3268). |
| `unlockedBy` | `string` | – | id whose unlock also grants this one (e.g. `quantumPortalExit` → `"quantumPortal"`). |
| `hideFromBuildMenu` | `boolean` | – | invisible in the build menu (filtered at 151649). |
| `disallowPick` | `boolean` | – | picker refuses to select it (118043). |
| `blockGridType` | `string` | – | see §3 (prefab/terrain grid type + alias). |
| `shape` | `number[][]` | –‡ | 2D footprint grid; `1` = occupied, else empty. Normalized unless `useRawShape`. §3. |
| `buildModes` | `BuildMode[]` | –† | placement drag modes. §3.A. |
| `variants` | `Variant[]` | – | rotational/facing variants. §3.B. |
| `render` | `RenderDef` | – | sprite rendering config. §3.C. |
| `draw` | `fn` | – | custom canvas render override. §3.D. |
| `copyData` | `boolean` | – | if `false`, copier won't duplicate this structure's `data` (→ `skipCopyData`). Default `true`. §3.E. |
| `defaultData` | `object` | – | template for per-instance `data`. Deep-cloned at register time (52547). |
| `rejectWhenBlocked` | `boolean` | – | if `true`, placement **rejected** where shape overlaps (2527, 2576, 72191). |
| `altOriginOffsetY` | `number` | – | extra Y offset when reverse-build key held (3121, 3284-3286). |
| `tooltipHover` | `object` | – | extra hover-inspector widget (e.g. `{ type: "filter" }`). |
| specialized fields | `object` | – | behaviour only read by that structure's own processor (kinetic press, grower, etc.). |

> ‡ A default 4×4 blockis applied for an unknown id when **no** `shape`/`render` (`be()` at 3231-3238).
> † Missing/empty `buildModes` → default `{ type: "line", directions: ["horizontal"] }` (2907-2911).

---

## 3. How `register` normalizes the object (verify against your params`

The body (52541-52565) does, in order:

1. `ot(def.buildModes)` — validates the build-modes array; throws on a malformed
   mode so a bad `buildModes` fails loudly at load..
2. `a = def.id`, `i = def.draw` — `id` and `draw` are pulled out up front..
3. `defaultData` is **deep-cloned** — your object is never re-used/mutated;
   instances get their own copy (52547..
4. `copyData === false` → sets `skipCopyData = true` (52548..
5. `render` (if set) is resolved by the render module before storing..
6. `shape` (if set and not `useRawShape`) is normalized cell-by-cell:
   `1` → Block, anything else → Empty (52551-52552..
7. `draw` is **extracted** and stored via `I._J(id, draw)` (52563-52564) —
   the stored definition keeps `draw: undefined` (52553-52556..
8. The type is registered with the worker; a differing `blockGridType` also gets
   an alias (`registerStructureTypeAlias`, 52559-52561..
9. `render` (if set) is also stored in the render-defs map `I.KP[id]` (52562) —
   which is why `render` and `draw` can coexist..

The options **actually consumed** inside `register` are `id`, `buildModes`, `draw`,
`copyData`, `render`, `shape`, `blockGridType`, `defaultData`,and everything else
is stored verbatim for the consumers in §4..

---

## 3.A. `buildModes: BuildMode[]` (nested`

Each element is one placement gesture the player can cycle through:

| Field | Type | Meaning |
|---|---|---|
| `type` | `string` | the gesture kind |
| `directions` | `string[]` | **only for line-like modes**: allowed orientations |

`type` values the engine recognises (UI labels, 2917-2919):

| `type` | Allowed `directions` | Notes |
|---|---|---|
| `"single"` | – | place one cell |
| `"singleDirectional"` | – | single placement with a facing/direction |
| `"line"` | `"horizontal"`, `"vertical"`, `"diagonal"` | drag a line |
| `"launcherRectUp"` | – | rectangle built & launched upward |
| `"launcherRectSide"` | – | side-launched rectangle |
| `"rectangle"` | – | drag a rectangle |
| `"rectangleDirectional"` | – | directional rectangle |

Multiple modes =the player cycles between them (e.g. Pump: `single`, `line`, `rectangle`).

---

## 3.B. `variants: Variant[]` (nested`

A structure supports several facing/rotation ids; `variants` maps each supported
angle to the actual type id placed. Engine source: 2100, 3246-3250.,

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | the structure id that represents this facing |
| `angles` | `number[]` | degrees this variant matches (`-180...180`; diagonals like 45/135/−45/−135 allowed) |

When a variant's list contains the requested angle, the engine resolves to that
variant's `id` instead (3246-3250.. A variant can point to a **different id**
(e.g. `ConveyorRight` → `ConveyorLeft`), which is why stub ids exist (`{}`
definitions written verbatim). The deco mod uses `variants: [{ id: typeId,
angles: [0] }]` — a single facing at 0 deg, all a decorative icon needs..

---

## 3.C. `render: RenderDef` (nested`

Tells the renderer which sprite asset to draw and at what size. The def is stored
in `I.KP[id]` (52562)and consumed for the world (1719-1720)and the build
menu (68191-68226.,

| Field | Type | Meaning |
|---|---|---|
| `imageName` | `string` | id of a sprite registered via `api.sprites.load`/`loadSpriteMap` — drawn at the structure position. |
| `size` | `{ width, height }` | natural pixel size, used for scaling (68210-68211.. |
| `size.width` | `number` | sprite pixel width |
| `size.height` | `number` | sprite pixel height |
| `offset` | `{ x, y }` | optional pixel offset (68213-68216;; non-zero also disables snap-merge (71802.. |
| `ui` | `object` | optional HUD/menu overrides — see below |

`ui` overrides (consumed at 68208-68225) let the menu swatch differ from the world:

| Field | Type | Meaning |
|---|---|---|
| `ui.size` | `{width, height}` | menu size (falls back to `size`) |
| `ui.width`/`ui.height` | `string` | explicit CSS sizes |
| `ui.offset` | `{x, y}` | menu offset (falls back to `offset`) |
| `ui.objectPosition` | `string` | css `object-position` (default `"top left"`) |
| `ui.clipToBounds` | `boolean` | applies `clip-path: inset(0)` |
| `ui.imageName` | `string` | different sprite id for the menu (falls back to `imageName`) |

A minimal render def — exactly what the deco mod passes:

```ts
render: {
  imageName: spriteId,               // e.g. "sandustry.icons:star"
  size: { width: item.width, height: item.height },
}
```

---

## 3.D. `draw: (state, structure, render) => boolean` (custom render`

An optional **canvas** render override, executed on the main thread each frame the
structure needs redrawing. Registered separately from the def via `I._J`
(52563-52564)so the stored definition stays serializable..

Callback parameters (verified from the built-in swarm-console draw, 39725-39751):

| Param | Type | Meaning |
|---|---|---|
| `state` | `object` |the state object passed through rendering |
| `structure` | `{ x, y, type?, data }` |the placed instance; `data` = per-instance data (from `defaultData` + copies). |
| `render` | `object` |render info — exposes `.ctx` (the 2D canvas context)and a `.placing` flag (true while previewing placement). |

Return: `boolean`.

- **`true`** → your draw handled rendering. The deco mod's `drawImageAligned`
  path draws the icon and returns `true`.
- **`false`** → the default sprite rendering continues. The built-in swarm console
  draws an extra placement ring and returns `false`, so its normal sprite is still drawn.

The deco mod's guard pattern is a safe template:

```ts
draw: (state, structure, render) => {
  const ctx = render?.ctx;
  if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false; // register+use the default path
  const image = sandkit.api.sprites?.getById(spriteId).imageAsset?.image;
  if (!image) return false;
  // compute world pixel origin + aligned rect, then ctx.drawImage(...)
  return true;
}
```

---

## 3.E. `copyData` / `defaultData` — instance data

- `defaultData` is the template written to a freshly placed structure's `data`
  field; deep-cloned once at register time (52547.. It must be JSON-serializable
  (the clone uses `JSON.parse(JSON.stringify(...))`).
- `copyData` gates whether the **copier** tool re-pastes an existing instance's `data`
  (73542:`copyData !== false && !skipCopyData`). Set `copyData: false`` (or omit
  it) for decorative/static structures whose data shouldn't be copied..

The deco mod relies on this: every icon places `defaultData: { itemId, align,
width, height, spriteId }`,and its `draw` re-reads `align` from
`structure.data` to recompute placement — with `copyData: true` so a duplicated
icon keeps its original alignment/sprite..

---

## 4. Consumers that read the stored definition

| Option | Reader |
|---|---|
| `nameKey`/`name`, `descriptionKey`/`description`, `categoryKey`, `order` | build-menu / picker entries |
| `alwaysUnlocked`, `unlockedBy` | menu unlock gating (3267-3268) |
| `hideFromBuildMenu` | build-menu filter (151649) |
| `disallowPick` | picker rejection (118043) |
| `rejectWhenBlocked` | placement collision handling (2527, 2576, 72191) |
| `shape` | collision / occupancy checks & `be()` resolution (3231-3250) |
| `variants` | angle→id resolution (3246-3250) |
| `blockGridType` | worker grid-type registration + alias (52559-52561) |
| `render` | world draw (1719-1720) + build-menu swatch (68191-68226) |
| `draw` | custom canvas render |
| `copyData`/`defaultData` | copier tool + placement data (73542) |
| `altOriginOffsetY` | placement origin shifting (3284-3286) |

---

## 5. Params used by `mods/buffer-controls/src/register.ts` — checked

Every option the mod passes to `sandkit.api.structures.register({...})` is a real,
consumed option in the bundle:

| register.ts field | Verified? | Notes |
|---|---|---|
| `id` (typeId) | ✅ | 52556 |
| `name` / `nameKey` | ✅ | build-menu display |
| `description` / `descriptionKey` | ✅ | tooltip text |
| `categoryKey: "blocks"` | ✅ | existing category (3132) |
| `buildModes: [{ type: "single" }]` | ✅ | validated by `ot` (52543); `"single"` is a known type (2918) |
| `variants: [{ id, angles: [0] }]` | ✅ | angle→id resolution (3246) |
| `render: { imageName, size }` | ✅ | stored in `I.KP[id]` (52562), read at 68191-68226 |
| `copyData: true` | ✅ | default; no `skipCopyData` set (52548) |
| `defaultData` | ✅ | deep-cloned (52547) |
| `hideFromBuildMenu: false` | ✅ | read at 151649 |
| `draw(state, structure, render)` | ✅ | extracted & registered via `_J` (52563-52564); the 3rd arg has `ctx`/`placing` |

The commented-out `alwaysUnlocked` / `rejectWhenBlocked` are also real options
(3268, 2083) — they're only disabled in this mod because a decorative icon needs
neither.

---

## 6. Minimal examples

**Decorative icon (the mod's pattern):**

```ts
sandkit.api.structures.register({
  id: "sandustry.icons:star",
  name: "Star icon",
  description: "Decorative icon. No collision.",
  nameKey: "sandustry.icons:star|name",
  descriptionKey: "structures|exampleJunction|description",
  categoryKey: "blocks",
  buildModes: [{ type: "single" }],
  variants: [{ id: "sandustry.icons:star", angles: [0] }],
  render: { imageName: "sprites:star", size: { width: 32, height: 32 } },
  copyData: true,
  defaultData: { itemId: "star", align: "floor", width: 32, height: 32 },
  hideFromBuildMenu: false,
  hideFromBuildMenu: false,
});
```

**Line-laid structure with facing variants (vanilla style):**

```ts
sandkit.api.structures.register({
  id: "myMod:pump",
  buildModes: [
    { type: "single" },
    { type: "line", directions: ["horizontal", "vertical"] },
  ],
  variants: [{ id: "myMod:pump", angles: [-180, -90, 0, 90, 180] }],
  nameKey: "myMod:pump|name",
  descriptionKey: "myMod:pump|description",
  categoryKey: "fluids",
});
```