# Element Engine — Example: "State over Density" (sink / float with custom behavior)

**Full runnable code:** [`worker-example-custom-displacement.js`](./worker-example-custom-displacement.js)

## The problem you're hitting

You want a particle to **fall normally through air**, but when it **sinks or
floats into another element** you want to decide the outcome yourself — not by
the engine's static `density` number.

The engine's default displacement is **strictly density-based**:

```
mover.density  >  occupant.density   → sink/push through (a SWAP)
mover.density <=  occupant.density   → blocked
```

And here's the catch: **moving into an occupied cell is a `swap`**
(`O`, bundel-worker.js:40633), and a swap has **no `element:move` interceptor
and no cancel token** — so you cannot veto or override it via `element:move`.
The only thing a swap emits is the `element:moved` notification (after the fact).

## The lever: `element:update`

`element:update` (bundel-worker.js:46341-46352) runs **before** the tick's
gravity/displacement resolver. If any of your handlers `cancel.cancel()`, the
engine hits an early `return` that **skips the resolver** for that element that
tick (including the density-swap and gravity).

So the general pattern is:

1. **In air → do nothing** → the engine runs its normal gravity + move.
2. **Contact detected** (the occupied cell in your travel direction is the
   trigger element) → `cancel.cancel()` the default *density* decision.
3. **Run your own rule.** Because cancel freezes the element that tick, you
   act *inside the handler*: transform it (`replaceAtCell`), spawn a product
   (`createAtCell`), freeze it (`setDataFieldAtCell`), or manually pass through
   (`swapBetweenCells`).

Recursion-safety note: `replaceAtCell` / `createAtCell` / `swapBetweenCells`
do **not** re-enter `element:update` synchronously, and `swap` has no
interceptor check — so calling them from inside the handler is safe.

```js
sandkit.api.hooks.intercept(
    "element:update",
    (e, payload, cancel) => {
        const T = {
            mote:  sandkit.api.elements.getTypeFromId(e, "mote"),
            water: sandkit.api.elements.getTypeFromId(e, "water"),
            steam: sandkit.api.elements.getTypeFromId(e, "steam"),
            froth: sandkit.api.elements.getTypeFromId(e, "froth"),
        };
        if (payload.elementType !== T.mote) return;      // only our type

        // Sinking solid → the cell it is about to enter is BELOW (y+1).
        const below = sandkit.api.elements.getResolvedTypeAtCell(e, payload.x, payload.y + 1);
        if (below !== T.water) return;                   // in air → normal fall

        cancel.cancel();                                 // stop the density swap

        // OUR rule (ignores density):
        const hot = sandkit.api.elements.getDataFieldAtCell(e, payload.x, payload.y, 1) === 1;
        if (hot) {
            sandkit.api.elements.replaceAtCell(e, payload.x, payload.y, T.steam, { duration: 1.5 });
            sandkit.api.elements.createAtCell(e, payload.x, payload.y + 1, T.froth, { duration: 0.6 });
        } else {
            sandkit.api.elements.setDataFieldAtCell(e, payload.x, payload.y, 2, 1); // freeze at surface
        }
    },
    { guard: { elementType: -1 } }                       // -1 wildcard; filter inside
);
```

> `element:update` **requires** a guard (it validates `elementType`), so pass
> `{ elementType: -1 }` (wildcard) and filter with `payload.elementType` inside
> the handler — the same convention as the `element:move` examples.

## Direction of travel (sink vs float)

| Element behavior | Cell to inspect | Example check |
|---|---|---|
| **Sinking** solid / liquid | the cell **below** | `getResolvedTypeAtCell(e, payload.x, payload.y + 1)` |
| **Floating** gas / buoyant | the cell **above** | `getResolvedTypeAtCell(e, payload.x, payload.y - 1)` |
| Horizontal lateral spread | left / right | `payload.x - 1` / `payload.x + 1` |

## Which knob makes this possible — decision table

| Goal during a sink/float encounter | Use | Why |
|---|---|---|
| Let it behave by density (default) | *(nothing)* | engine swap just does it |
| **Override how it reacts on contact** | `element:update` hook + `cancel.cancel()` | runs before the resolver; cancel stops the swap so you can act |
| Keep falling in air | *(nothing)* → just `return` without cancel | default move path |
| Observe that it sunk/swapped (after the fact) | `element:moved` event | notification only, can't change outcome |
| Refuse the sink (hover/freeze) | `element:update` + `cancel.cancel()` each tick | the cancelled tick never swaps |
| Manually force passing through (custom eligibility) | `element:update` + `swapBetweenCells` after cancel | replace density test with your own condition |
| **Veto a *blocked* collision** (denser occupant in the way) | `element:blocked` hook | only fires when the move is *obstructed*, not on a successful swap |

> ⚠️ Remember: cancelling `element:update` freezes **everything** for that
> element that tick (no gravity, no move, no duration decrement). So when you
> cancel to stop a sink, you must perform your own reaction inside the handler,
> or the particle will simply hover in place (which is itself a valid behavior).

---

## Managing the bilateral (symmetric) rule

The density compare is always `mover.density > occupant.density`, evaluated
from whichever element is the **current mover** each tick. That has one crucial
management consequence for your handler:

- **Your `element:update` hook only runs when YOUR element is the mover**
  (the element being stepped). For sink/float that is correct: your particle is
  the one moving into the other substance.
- It does **NOT** run when a **denser** element is the mover sinking *into your
  element's cell*. In that case the *other* element's update is the mover, so
  your mote handler stays silent and the denser element displaces your mote.

So you must pick exactly what you want to override in each direction:

| You want… | Approach | Notes |
|---|---|---|
| Only override when *your* element is the denser mover (it would sink) | **Branch on density** (`A`) | Compare `getDefinitionByType(...).density` before cancelling; skip when your element is lighter (engine already floats it) |
| Normal air movement preserved | Don't cancel when `below` is empty | default gravity + move runs |
| Protect your element from a *denser* mover | **Hook that mover** (`B`), or **density-charge** (`C`) | The mover's `element:update` is what runs — veto it there; or register your element denser so nothing displaces it |
| Element can never be pushed out of the way | **Density-charge** (`C`) | `density` ≥ every thing it can meet; same-type still never displaces |
| Let the engine decide normally | *(do nothing)* | default density swap |

```js
// A) act only when YOUR element is the denser mover
const moteDens = sandkit.api.elements.getDefinitionByType(e, T.mote).density;
const occDens  = sandkit.api.elements.getDefinitionByType(e, below).density;
if (!(moteDens > occDens)) return;   // lighter → engine already floats it
cancel.cancel();                      // denser → it would sink; override now

// B) protect mote from a denser mover (gold) — hook the MOVER, not mote
sandkit.api.hooks.intercept("element:update", (e, p, cancel) => {
    if (p.elementType !== T.gold) return;
    if (getResolvedTypeAtCell(e, p.x, p.y + 1) !== T.mote) return;
    cancel.cancel();                  // stop gold displacing mote
}, { guard: { elementType: -1 } });

// C) density-charge at registration: density: 10000 → never displaced
```

This is exactly the pattern for "state over density" that keeps the things the
engine is good at (falling in air, floating when lighter) and only replaces the
one decision you care about (what happens on contact).

---

## Taking ownership with `setPhysicsAtCell(…, PHYSICS.SKIP)`

Instead of `cancel.cancel()` every tick, you can **pull the element out of the
engine's gravity/displacement resolver** with `setPhysicsAtCell`. This is
cleaner for a pipeline that wants to be the sole mover while the particle sits
in liquid.

### The raw `PHYSICS` values

The `PHYSICS` enum (engine, bundel-worker.js:1206-1214) is tiny:

| Name | Raw value | Meaning |
|---|---|---|
| `PHYSICS.NORMAL` | **`0`** | default — fully simulated (gravity, displacement) |
| `PHYSICS.SKIP` | **`1`** | skip the physics update for this element (stays alive, not simulated) |
| `PHYSICS.AGGRESSIVE_SKIP` | **`2`** | skip + ignore timers/collectors; until explicitly re-set |

There is no `PHYSICS` enum injected into the mod worker namespace by default, so
modders pass the **raw number**. Reproduction from `scripts`:

### Example — freeze a particle "in" another liquid

```ts
const PHYSICS_SKIP = 1;             // PHYSICS.SKIP raw value
const PHYSICS_NORMAL = 0;           // PHYSICS.NORMAL raw value

// inside your element:update handler (guard elementType = your seed):
sandkit.api.hooks.intercept(
    "element:update",
    (e, payload, cancel) => {
        const api = sandkit.api;
        // We are touching the target liquid → stop the engine, we take over.
        // setPhysicsAtCell also calls reportActivityToChunk (extra-mod-worker.js:421),
        // which keeps the chunk awake — so you do NOT fall into the "cancelled →
        // no activity → chunk sleeps → element frozen forever" trap.
        api.elements.setPhysicsAtCell(e, payload.x, payload.y, PHYSICS_SKIP);

        // ...run your own move/dispatch now (swapInto etc.).
        // You are the only mover while SKIP is set.
    },
    { guard: { elementType: -1 } },
);
```

### Do you need to set it every time? **No — it is sticky**

`setPhysicsAtCell` writes the element's `skipPhysics[index]`. Unlike `cancel`
(which only lasts for that one tick's dispatch), `SKIP` **persists** on the
element until you write it back to `PHYSICS.NORMAL (0)` or replace/remove the
element. So:

- **Set it once** when the particle enters the liquid → it stays out of physics.
- **Do NOT** need to re-call it each tick.
- **Re-arm when done** — when you want the particle to fall/move normally again
  (e.g. it leaves the liquid, or you spawn a new element after crystallising),
  write `PHYSICS.NORMAL`:
  ```ts
  api.elements.setPhysicsAtCell(e, x, y, PHYSICS_NORMAL); // back to normal physics
  ```
- **`0` is the default** — a brand-new element starts at `skipPhysics = 0`
  (NORMAL). You only call `setPhysicsAtCell` when switching to SKIP (1) and back.

### SKIP vs AGGRESSIVE_SKIP vs cancel — quick map

| Approach | Persists? | Element still simulated? | Keeps chunk alive? | Use when |
|---|---|---|---|---|
| `cancel.cancel()` in a hook | **No** (one tick) | Yes, resume later | **No — you must call `world.reportActivityAtCell`** | you only want to veto one tick, then let the engine continue |
| `setPhysicsAtCell(…, PHYSICS.SKIP=1)` | **Yes** | No (out of resolver) | ✅ auto (`setPhysicsAtCell` reports activity, extra-mod-worker.js:421) | pipeline owns the particle while it's in a liquid |
| `setPhysicsAtCell(…, AGGRESSIVE_SKIP=2)` | **Yes** | No, plus ignores collectors/timers | ✅ auto | full "this cell is mine" control |
| `PHYSICS.NORMAL (0)` | sticky — resets to default | Yes | n/a | leaving the owned state |

**Key reminder (ties to the earlier "chunk sleep" gotcha):** `cancel` does
**not** auto-report chunk activity, so a repeatedly-cancelled element can fall
into a sleeping chunk and stop being updated (frozen-but-alive). `setPhysicsAtCell`
**does** call `reportActivityToChunk` internally, so SKIP both stops the engine
and keeps the chunk awake — one call, both problems solved.

---

## Sleeping chunks — why particles "stop updating", and how to wake them

There is **no per-particle sleep flag**. The engine sleeps at the **chunk** level
(bundel-worker.js:40313-40450, processor `k`):

- A cell is only stepped when `shouldChunkUpdate` is true, i.e. when the chunk's
  `chunkShouldUpdate[n] === 1` (19699-19704). `element:update` (= `a.cJ` / `ce`)
  is only dispatched from inside that processor, so **a sleeping chunk never
  fires `element:update` for any particle in it** (40313-40235 early-return).
- A chunk goes to sleep when nothing reports activity into it; its `activeChunks`
  counter decays to 0 (40345-40450).
- **Activity** is reported via `reportToChunkAtCellPos` (19718-19729), which
  re-arms the chunk *and its edge neighbours* for next frame.

So a resting pile that stops moving stops producing activity → its chunk decays
→ the whole pile (not just one particle) stops getting `element:update`.

**Does a blocked/resting particle still pass through `element:update`?**
Only if its chunk is awake. If the chunk is awake, `element:update` fires for
**every** element in it, resting or not (it's dispatched before the gravity /
`skipPhysics` checks at 46341-46356). The "no more tick" symptom = the chunk fell
asleep, not a per-particle pause.

### Why your bottom-water pile freezes

- A normal **self-falling** move reports activity automatically (the move helper
  `cZ` takes the activity reporter `U` as a callback — 46849, 46884), so a
  falling chain keeps waking the chunk.
- But **`swap` does NOT report activity** (the swap helper `O` at 40633-40680 has
  no `reportToChunk`), and neither does a cancelled `element:update`. Your
  pipeline moves the seed via `swap`/`cancel`, so it never reports activity → the
  pile's chunk decays → the particles stacked above never get woken to fall in.

### How to wake a sleeping pile

Call the mod-facing reporter at the cells you want re-activated. This re-arms the
chunk (and edge neighbours) for next frame:

```ts
// module scope / once, at top of worker
const api = () => sandkit.api;

// inside your pipeline action, after you move the seed (or at the base of the pile):
api().world.reportActivityAtCell(p.x, p.y);        // wake the chunk the seed is in
api().world.reportActivityAtCell(p.x, p.y - 1);    // wake the cell ABOVE (the next to fall)
```

`reportActivityAtCell` → `reportActivityToChunk` → sets `chunkShouldUpdateNext` for
that chunk plus its 4 edge neighbours (extra-mod-worker.js:561, bundel-worker.js:
19718-19729). Once the chunk is re-armed, `element:update` fires again for every
particle in it next frame, and the pile collapses/follows normally.

### Detecting "sleep" from a mod

There is no direct API that returns "is this chunk awake?". Practical approaches:

1. **Position/age watchdog** — store a per-particle "last tick moved" in a data
   field (you already store the profile `age`). If you expected the pile to
   change but it hasn't across N ticks, treat it as asleep and fire
   `reportActivityAtCell` at the stack's base.
2. **Always report cover** — simpler and more robust: from the pipeline, call
   `reportActivityAtCell` at your seed's old + new cell (and one above) every
   time you act. Then the chunk never sleeps while you own it, and you never need
   to *detect* sleep at all.

> Note: the mod's typed facade (`src/shared/types.ts::SandkitApi.world`) currently
> only declares `isCellEmptyAtCell`. To call `reportActivityAtCell` you must add it
> to that interface (the runtime already exposes it, extra-mod-worker.js:561).