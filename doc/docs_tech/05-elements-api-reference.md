# Element Engine — `sandkit.api.elements` Function Reference

The mod-facing read/write API for the element simulation. All functions are
`Object.freeze`-locked facades over the engine (`elements.*`); several are
guarded on a **resolved element being present** at the cell and no-op otherwise.

Convention used in the reference examples:
- `e` / `t` — a two-coordinate cell `(x,y)`; `payload` params reuse the letter
  the engine's facade uses, so signatures below read `(…)` for the mod-facing
  args only.
- `typeOrId` — many functions accept either an internal type number or a
  string id; the facade resolves via `getElementTypeFromId`.
- The example file also calls these as `getElementTypeFromId`, `getTypeFromId`,
  `swapCells`, etc. — both names are exposed (see the alias table at the end).

---

## 1. Type lookups

| Function | Purpose |
|---|---|
| `getTypeFromId(e, id)` / `getElementTypeFromId(e, id)` | string id → internal element type number |
| `getIdByType(e, type)` | internal type → string id |
| `getDefinitionByType(e, type)` | element config/definition object |

```js
const sand = sandkit.api.elements.getTypeFromId(e, "sand");   // type number
const def  = sandkit.api.elements.getDefinitionByType(e, sand);
```
Engine: `getElementTypeFromId`, `getElementIdFromType`, `getConfig`.

---

## 2. Cell queries

| Function | Guarded on resolved type? | Returns |
|---|---|---|
| `getTypeAtCell(e, x, y)` | no | raw type at cell |
| `getResolvedTypeAtCell(e, x, y)` | — | resolved type (dynamic/transitional states); `null` if none |
| `getResolvedTypeFromCellId(e, id)` | — | resolved type from a cell id |
| `getInfoAtCell(e, x, y)` | no | richer info object (type + extras) |
| `getMatterTypeAtCell(e, x, y)` | no | matter state category: Solid, Liquid, Gas, Particle, Static, Slushy, Wisp, Powder |
| `isTypeAtCell(e, x, y, typeOrId)` | no | boolean (accepts type or id) |
| `isFreeFallingAtCell(e, x, y)` | yes | whether in free-fall physics state |

```js
sandkit.api.elements.getTypeAtCell(e, x, y);
const occupant = sandkit.api.elements.getResolvedTypeAtCell(e, x, y); // null if empty
sandkit.api.elements.isTypeAtCell(e, x, y, "water");
```

---

## 3. Cell mutation

| Function | Behavior |
|---|---|
| `createAtCell(e, x, y, typeOrId, opts)` | create **only if the cell is empty** |
| `replaceAtCell(e, x, y, typeOrId, opts)` | overwrite unconditionally |
| `removeAtCell(e, x, y, opts)` | remove if something is resolved |
| `moveBetweenCells(e, sx, sy, dx, dy)` | move into an **empty** cell only; passes through `element:move` hook |
| `teleportBetweenCells(e, sx, sy, dx, dy)` | instant relocation; bypasses adjacency/physics (fires `teleport:effect`) |
| `swapBetweenCells(e, …)` / `swapCells(e, …)` | exchange two **occupied** cells (atomic, not interceptable) |

`opts` for create/replace (normalized by the facade):
```js
{
  dataFields:   { field1, field2, field3, field4 }, // per-instance data
  duration:     1.0,        // sets durationMax / durationLeft
  density:      null,       // override instance density
  isFreeFalling: false,
  data:         { ... },    // arbitrary element data
  particle:     { velocity: {x, y} },  // for particle-type elements
  skipCollectorCheck: false,
}
```
The facade also normalizes a legacy `durationTicks` option into `duration`.

---

## 4. Velocity & physics state

| Function | Guarded? | Purpose |
|---|---|---|
| `getVelocityAtCell(e, x, y)` | yes | returns `{x,y}` or `null` if nothing resolved |
| `setVelocityAtCell(e, x, y, {x, y})` | no | set velocity directly |
| `addParticleVelocityAtCell(e, x, y, {x, y}, maxClamp)` | no | accumulate velocity on a particle-type element |
| `setPhysicsAtCell(e, x, y, physicsFlags)` | yes | set physics mode; also wakes the chunk |
| `markMovementBlockedByIndex(e, idx)` / `markMovementBlockedByElementIndex(e, idx)` | no | mark an element (by index) as movement-blocked; alias of the same fn |

Physics flags come from `sandkit.api.constants.PHYSICS`:
- `PHYSICS.SKIP = 1`, `PHYSICS.AGGRESSIVE_SKIP = 2`
  (bundel.js:1253-1254). `skipPhysics[i] >= AGGRESSIVE_SKIP` removes an element
  from the gravity/move resolver entirely.

`markMovementBlockedByIndex` is wired to the `element:move:blocked` /
`element:blocked` naming and is meant to be called *in response to* a blocked
event rather than freely — it mimics a blocked tick: clamps velocity toward
`minVelocityY`, sets `isFreeFalling = 0`.

---

## 5. Data fields (per-instance custom state)

Elements carry **four** named data fields (`dataField1..4`) indexed per
instance. These are the engine-sanctioned place to store custom per-element
flags (temperature, wetness, frozen, age, …).

| Function | Guarded? | Purpose |
|---|---|---|
| `getDataFieldAtCell(e, x, y, n)` | yes | read field `n` (1–4); `null` if nothing resolved |
| `setDataFieldAtCell(e, x, y, n, value)` | yes | write field `n` |
| `setDurationAtCell(e, x, y, amount, opts?)` | yes | set/reset duration; `{ updateMax: true }` re-arms the max too |

Examples:
- "frozen" flag in field 1 to hard-cancel movement (example #2).
- "temperature" in field 2 to pick blocked-conversion (example #4).
- "birth tick" in field 3 for age behavior (example #11).
- "wet" flag in field 4 for fire resistance (example #17).

---

## 6. Particle conversion & misc

| Function | Purpose |
|---|---|
| `convertToParticleAtCell(e, x, y)` | convert the element at a cell to its particle form |
| `convertFromParticleAtCell(e, x, y)` | convert a particle back to its non-particle form |
| `refreshColorAtCell(e, x, y)` | force a color/sprite refresh (no return) |

---

## 7. Annotated engine aliases (facade name → engine call)

| Exposed name(s) | Engine call | Guarded on resolved type? |
|---|---|---|
| `getTypeById`, `getTypeFromId`, `getElementTypeFromId` | `getElementTypeFromId` | — |
| `getIdByType` | `getElementIdFromType` | — |
| `getDefinitionByType` | `getConfig` | — |
| `getTypeAtCell` | `getTypeAtCell` | no |
| `getResolvedTypeAtCell` | `getResolvedTypeAtCell` | — |
| `getResolvedTypeFromCellId` | `getResolvedTypeFromCellId` | — |
| `getInfoAtCell` | `getInfoAtCell` | no |
| `getMatterTypeAtCell` | `getMatterTypeAtCell` | no |
| `isTypeAtCell` | `isTypeAt` | no |
| `isFreeFallingAtCell` | `isFreeFalling` | yes |
| `createAtCell` | `createAt` | requires empty cell |
| `replaceAtCell` | `replaceAt` | no |
| `removeAtCell` | `removeAt` | yes |
| `moveBetweenCells` | `move` | no |
| `teleportBetweenCells` | `teleport` | no |
| `swapBetweenCells`, `swapCells` | `swap` | no |
| `getVelocityAtCell` | `getVelocity` | yes |
| `setVelocityAtCell` | `setVelocity` | no |
| `addParticleVelocityAtCell` | `addParticleVelocity` | no |
| `convertToParticleAtCell` | `convertToParticle` | no |
| `convertFromParticleAtCell` | `convertFromParticle` | no |
| `getDataFieldAtCell` | `getDataField` | yes |
| `setDataFieldAtCell` | `setDataField` | yes |
| `refreshColorAtCell` | `refreshColorAt` | no |
| `markMovementBlockedByIndex`, `markMovementBlockedByElementIndex` | `markMovementBlocked` | no |
| `setPhysicsAtCell` | `setPhysics` + `reportActivityToChunk` | yes |
| `setDurationAtCell` | `setDuration` | yes |

---

## 8. `move` vs `swap` — the real difference (bundel.js:51339, 51484)

`move` and `swap` are **not** the same operation and behave very differently
for modding.

| Behavior | `move` → `cZ` | `swap` → `Hc` |
|---|---|---|
| Elements affected | One (relocated to now-empty dest) | Two (contents exchanged) |
| Preconditions | source has element, **dest empty** | **both** cells occupied |
| Mod interceptable | ✅ fires `element:move` hook; an interceptor can **cancel** the move (position update + `element:moved` skipped) | ❌ **no** hook anywhere; cannot be cancelled |
| `element:moved` events | one (the move) | up to two (each participant) |
| Velocity side effect | none in `cZ` | clamps first participant's `velocityY` to max 60 |
| Structure/audio side effect | source on a **SoundBox** tile triggers the piano-note when leaving | re-runs tile/sound refresh for both cells if either sits on a structure |

**Practical guidance**
- Use **`move`** to relocate one element into a known-empty cell — but remember
  any mod (or engine) can veto it via `element:move`.
- Use **`swap`** to exchange two occupied cells (e.g. something falling
  through/past something else) — it's atomic, always goes through, and both
  participants get `element:moved`; but it fails if either side is empty.
- From inside an `element:move` hook, use **`swap` to avoid recursion** (swap
  has no interceptor check).

---

## 9. Velocity & density physics (from the gravity resolver)

### How a falling/rising element moves each tick (bundel.js:4206-4253)

```
1. Accelerate:   accel = (dir === "down" ? gravity : upflow) * (gravityFactor ?? 1)
                 velocityY += accel * dt            (clamp to ±maxVelocityY if set)
     Exception (hollow structure + active filter): velocityY = (dir up ? -1 : 1)*(gravity/60)

2. Accumulate displacement:     thresholdY += velocityY * dt

3. Try to move a full cell only when the threshold crosses 1:
     if |thresholdY| < 1:  no move (but set isFreeFalling=1 if a free path exists)
     else: deltaY = ceil/floor(thresholdY); thresholdY %= 1;
           resolve those cell-steps (handles diagonal slide, hollow passthrough)

4. Outcome:
     consumed (Collector/etc. "ate" the move) → handled, no velocity change
     blocked:  falling → if velocityY > minVelocityY: velocityY = minVelocityY
                       (wake neighbor chunk if beyond ±60)
               isFreeFalling = 0
     moved:    isFreeFalling = 1
```

### Key takeaways

- **Gravity is unconditional.** Re-applied every tick regardless of
  `isFreeFalling` / `skipPhysics` / any hook. The only things that stop it are
  `skipPhysics >= SKIP` (element removed from the resolver) or explicitly
  zeroing/clamping velocity yourself each tick.
- **`isFreeFalling` is an *output*, not an input.** It's set to `1` on a
  successful move / free path, reset to `0` on blocked. Setting it manually
  (e.g. `markMovementBlockedByIndex`) mimics a blocked tick's *result*; it
  doesn't reach into the resolver math.
- **`minVelocityY`** is a per-element resting floor/ceiling (default
  `gravity/60` at spawn) used solely to clamp toward on a blocked collision.
- **±60** is the hardcoded "fast enough to wake a neighbor chunk" cutoff.

### Density — who may displace whom

Density is a per-type number (defaults: Sand 150, WetSand 150, Residue 50,
Gold 300, Water 100) copied onto each instance at spawn.

Core comparison deciding whether a mover can displace an occupant:

```js
function canDisplace(mover, occupant) {
    if (mover.type === occupant.type) return false;        // same type never displaces

    // Structure filter override (e.g. a grate with an elementMask):
    if (occupant is on a filtered structure tile) {
        moverAllowed   = filterElementMask.includes(mover.type);
        occupantAllowed = filterElementMask.includes(occupant.type);
        if (moverAllowed !== occupantAllowed) return moverAllowed; // mask decides
    }

    return mover.density > occupant.density;               // strictly greater
}
```

- Displacement is **strict `>`** — equal density never displaces.
- A structure tile configured as a density-agnostic **filter (element mask)**
  can force the outcome either way, ignoring densities.
- Density *also* gates **build/filter-grate authorization**: a filter with a
  minimum `density` threshold rejects anything below it — a placement/flow
  authorization check, separate from the tick collision check.

#### Is the comparison symmetric? (A denser than B ⇔ B denser than A)

**Yes — the rule is bilateral.** The compare is always
`mover.density > occupant.density`, evaluated **fresh from whichever element is
the current mover** every tick (bundel-worker.js:46412-46442). So:

| Scenario | `canDisplace(mover, occupant)` | Result |
|---|---|---|
| A tries into B's cell, A denser | `A.density > B.density` | ✅ A displaces B |
| B tries into A's cell, A denser | `B.density > A.density` | ❌ B is blocked |
| A tries into B's cell, B denser | `A.density > B.density` | ❌ A is blocked |
| B tries into A's cell, B denser | `B.density > A.density` | ✅ B displaces A |

The denser element always wins the cell, whichever side is labelled A or B.
Two **caveats** that are *not* symmetric:

1. **Same type never displaces** — `mover.type === occupant.type` short-circuits
   to `false` **both ways**, no matter how their densities differ.
2. **Filter / element-mask gratings are directional.** A mask decides via the
   *mover's* membership in the mask (bundel-worker.js:46425-46436), so it maps
   to travel direction (e.g. mask-members pass one way), and it **overrides
   density entirely** whenever the two elements' mask membership differs.

And a full-motion reminder: the compare only fires for the cell(s) an element
actually attempts to enter — **down** for a sinking Solid/Liquid, **up** for a
rising Gas, **sideways** for spread. So density decides "which wins the cell,"
while matter type + gravity decide *which direction* it is trying to move that
tick.

### Where velocity and density intersect

- **Velocity** governs *whether / how far* an element attempts to move this
  tick.
- **Density** governs whether it's *allowed to displace* whatever occupies the
  destination.
- Dense mover → less-dense occupant = displacement succeeds.
  Less-dense mover → denser occupant = fails → **`element:blocked`** path
  (velocity clamped to `minVelocityY`, `isFreeFalling = 0`).