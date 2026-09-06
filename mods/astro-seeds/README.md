# Astro Life — a discrete Particle Life for a falling-sand engine

This module adds a second, independent seed family — **Life Seeds** — that
behave like [Particle Life](https://sandbox-science.com/particle-life):
several colors of particle, a signed attraction matrix between every pair
of colors, and asymmetric coefficients that make the swarm chase, flee,
orbit, and cluster instead of just diffusing.

It does **not** touch the existing Gold/Copper/Water astro-seed pipeline.
It's a self-contained add-on: two new files, one new element family, one
new panel section. Read this document once — the whole point of writing
it is that the translation from continuous physics to this grid engine is
not obvious, and every design choice below exists because something in
the naive port genuinely doesn't work here.

---

## 1. What Particle Life actually computes

For N particle *colors*, you define an N×N matrix `A`, where `A[i][j]` is
a signed number: how strongly a particle of color `i` is pulled toward
(positive) or pushed away from (negative) a particle of color `j`.
Critically, `A` is **not required to be symmetric** — `A[i][j]` and
`A[j][i]` can differ. That asymmetry is the entire trick: if red is
strongly attracted to green (`A[red][green] = +0.8`) but green is
repelled by red (`A[green][red] = -0.6`), green flees and red chases —
a predator/prey pair emerges from two numbers, no chase logic was coded.

Every tick, every particle sums a force contribution from every other
particle within some radius `R`:

```
for each neighbor p at distance r (0 < r < R):
    if r < beta*R:                      # hard core
        f = r/(beta*R) - 1              # always repulsive, strongest at r=0
    else:                                # tent function
        t = (r - beta*R) / (R - beta*R)
        f = A[my_color][p.color] * (1 - |2t - 1|)   # peaks mid-band, 0 at both ends
    force += f * normalize(p.pos - my.pos)

velocity = (velocity + force) * friction   # friction < 1, e.g. 0.5–0.9
position += velocity
```

The hard core stops particles from collapsing into a single point. The
tent-shaped mid-band is what gives a *preferred following distance*
rather than "attract forever until touching." Friction on velocity is
what turns a straight chase into an orbit — without it, an attracted
particle just overshoots and oscillates through its target forever.

Three ingredients, in other words: **(a)** a distance-shaped force curve,
**(b)** an asymmetric matrix, **(c)** momentum with damping. All three
assume continuous floating-point position and velocity *vectors*.

---

## 2. The four things that don't exist in this engine

| Continuous Particle Life needs... | This engine gives you... |
|---|---|
| Floating-point position/velocity | `uint16` data fields per cell — integers only, and only a couple of free slots |
| A distance `r = \|p1 - p2\|` and a unit direction vector | 8 compass headings, integer cell offsets, no `sqrt`, no angle |
| Force integration over every particle in a disc of radius R | An unbounded-cost operation on a grid this size — not viable per-tick, per-seed |
| `position += velocity` (continuous, any direction) | `swapCells(x,y,nx,ny)` — **adjacent cells only**, one discrete step at a time |

Every one of these is a hard constraint, not a style preference — the
first three are why `columnForce` (the mod's existing force primitive)
looks the way it does, and the fourth is why even `columnForce` moves by
repeating single-step swaps in a loop rather than "jumping" anywhere.

---

## 3. The adaptation, piece by piece

**Disc-integration → 8-directional line-of-sight survey.**
Instead of summing a force contribution from every particle within a
radius (unbounded, continuous), each seed casts one ray per compass
direction (N, NE, E, SE, S, SW, W, NW), walking outward up to `rangeN`
cells and stopping at the **first** occupied cell it hits — matching
exactly what `columnForce` already does for a single direction. This
turns an O(particles in radius) integral into a fixed O(8 × rangeN) scan,
independent of how crowded the swarm gets.

**Tent-shaped force curve → inverse-distance weight.**
A continuous tent function needs real numbers and a smooth peak. The
discrete replacement: weight a found neighbor's contribution by
`rangeN - distance + 1` — closer neighbors count for more, linearly,
computed entirely in integers. This isn't the same curve, but it has the
same qualitative shape (stronger pull from nearby, fading with distance)
and needs no floats at all.

**Hard-core repulsion → the engine's own solid-body physics, for free.**
Continuous Particle Life has to hand-code a repulsion term so particles
don't overlap. Here, two Powder cells *physically cannot occupy the same
cell* — the falling-sand simulation already enforces that. Combined with
the inverse-distance weight (a touching neighbor at distance 1 gets the
*highest* weight), a strongly negative `A[i][j]` at point-blank range
already produces immediate, forceful separation without a single extra
line of code. This is the one place the engine hands us something
Particle Life has to build itself.

**Vector force sum → signed per-direction scalar, pick the best.**
For each of the 8 directions, sum `A[myColor][foundColor] × weight` across
whatever was found looking that way (only one thing per ray — the first
hit — so this is a single term, not a sum, per direction in the common
case). The direction with the highest signed score wins. A strongly
negative score in every direction *except* one still correctly picks
"the least bad direction" — the same way a real vector sum would resolve
into a net heading, just quantized to 8 choices instead of 360°.

**Velocity + friction → momentum via the two already-reserved, unused
data fields (`VX`, `VY`).**
This mod's own field enum already declares `VX = 2, VY = 3` and never
uses them — clearly reserved for exactly this. Rather than store a real
velocity, each field holds the *previous tick's chosen direction*
(`-1 / 0 / +1` per axis, i.e. 3 possible values each — fits trivially in
a `uint16`). When scoring this tick's 8 directions, a direction that
matches last tick's gets a flat momentum bonus; a direction that's the
exact opposite gets a penalty. That's discrete inertia: it costs two
small integers and reproduces the qualitative effect friction has in the
real algorithm — a chase curves into an orbit instead of snapping back
and forth every tick — without ever storing a fractional value.

**Continuous position integration → the existing multi-step swap loop.**
Once a direction is chosen, step up to `maxK` cells that direction via
repeated `swapCells` calls, stopping the moment a step fails (blocked,
off liquid, whatever) — verbatim reuse of the loop `columnForce` already
runs. No new movement primitive was needed here at all.

**The float-precision attraction matrix itself → the existing JSON
config buffer, not a data field.**
The matrix is read once per tick per seed but only *changes* when a
player edits it in the panel — it belongs in config, not per-cell state.
The mod already has exactly this pattern wired up for `columnForce`
(`astroJson` shared buffer + a change counter for cache invalidation).
This module extends the same JSON shape with one more top-level key
(`lifeMatrix`) instead of adding a second buffer — one parser, one
cache-invalidation counter, two config domains.

---

## 4. Why this still produces "life," not just noise

The qualitative behaviors that make Particle Life recognizable —
clustering, chase/flee pairs, streaming filaments, slow orbiting
swarms — all come from the *asymmetry of the matrix* and *momentum*, not
from the specific shape of the force curve or the precision of the
position. Both of those survive the translation intact: the matrix is
still asymmetric floats (stored as JSON, not degraded), and momentum is
still present (just quantized to 9 states instead of a continuous
vector). What's lost is smoothness — orbits will look faceted along 8
headings rather than curved, and the follow-distance "band" is now a
linear falloff instead of a tent curve. What's gained is that it runs at
all inside a grid simulation with no floating point per cell and no
vector math, at a fixed, bounded cost per seed per tick.

---

## 5. Default matrix shipped

Four colors, a clean chase cycle plus a little cross-coupling so it
doesn't collapse into a simple loop:

```
              Ruby   Sapphire  Emerald  Topaz
    Ruby     [ -20,     70,      10,    -60 ]
    Sapphire [ -60,    -20,      70,     10 ]
    Emerald  [  10,    -60,     -20,     70 ]
    Topaz    [  70,     10,     -60,    -20 ]
```

Read as `A[row][col]`: Ruby is strongly attracted to Sapphire (+70, the
next color around the cycle), strongly repelled by Topaz (-60, the color
one step *behind* it — the one chasing Ruby), mildly drawn to Emerald
(+10, two steps around), and mildly self-repelling (-20, so a same-color
group spreads into a loose swarm rather than a solid clump). Rotate the
whole matrix one column and you get the next color's row — a *circulant*
matrix, generated directly from the rule `self=-20, next=+70,
previous=-60, two-away=+10` rather than typed out by hand: a first draft
of this matrix, hand-typed, had the "previous" and "two-away" columns
transposed in every row, which silently produced a *symmetric*, non-chasing
relationship instead of the intended asymmetric one — with no error, no
crash, just quietly wrong emergent behavior. Worth generating this kind
of matrix programmatically from the rule rather than by hand, and
verifying `A[i][j] !== A[j][i]` for any pair you expect to be a
predator/prey relationship.

---

## 6. Integration points

These files were written against the decompiled output of the current
`main.js`/`worker.js` bundle (this mod's actual TypeScript source tree
wasn't available to graft into directly) — so wiring them in is a small,
explicit step rather than a drop-in replace:

**`worker-extra.ts`**
- Exports `registerLifeSeedDispatch()` — call this once at worker
  startup, alongside the existing `element:moved` / `element:blocked`
  hook registration in `main.ts` (the pattern is identical: guard on
  each life-seed type, dispatch into `stepLifeSeed`).
- Exports `LIFE_SEED_IDS` (the element id strings) so `main-extra.ts` and
  the worker agree on what's registered without a second source of truth.
- Reads the attraction matrix through `lifeMatrixConfig()`, which expects
  a shared buffer named `astroJson` (uint8, JSON) and a change-counter
  index — reuses the *existing* `astroJson` buffer and
  `JSON_COUNTER_INDEX` this mod already created, rather than allocating
  a second buffer. If your real source names these differently, only
  `configSchema.ts`'s constants need re-pointing.

**`main-extra.ts`**
- Exports `registerLifeSeedElements()` — call once from the main thread's
  existing element-registration block, right after the astro-seed family
  is registered.
- Exports `mountLifeMatrixPanel()` — call alongside the existing
  `mountPanel()` call. It renders as an extra collapsible section using
  the exact same `h(...)` / `Toggle` / `Stepper`-style primitives the
  current panel already uses, so it visually matches rather than looking
  bolted on.

Both files are dependency-free aside from `sandkit`/`api` globals and
each other's exported types — no new npm packages, no build config
changes beyond adding two files to whatever `tsc`/bundler entry list
already picks up `main.ts`/`worker.ts`.

---

## 7. Tuning guide

| Knob | Effect |
|---|---|
| `A[i][j]` magnitude | How strongly color `i` reacts to color `j`. Keep values in roughly ±100 (matches the existing `columnForce.rateFn` percent convention) — very large values just saturate the direction choice and stop being interesting. |
| `rangeN` | How far a seed can "see." Higher = more global clustering, slower per-tick (cost scales linearly with it). |
| `maxK` | How far it commits to moving once a direction wins. Higher = faster, twitchier swarms; lower = slow drift. |
| `momentumBonus` | How sticky inertia is. `0` disables momentum entirely (reverts to snap-to-best-direction every tick — noisier, no orbiting). Too high and seeds barrel through good stopping points. |
| Color count | Cost is linear in colors × directions × rangeN per seed per tick. 4–6 colors is the sweet spot; the panel doesn't hard-limit it, but performance will make the ceiling obvious. |

## 8. Known limitations

- Directions are quantized to 8 headings — smooth orbital motion from the
  original demo will look faceted here, not curved.
- The distance weight is linear, not the tent curve — there's no
  "sweet spot" distance band the way the original has via `beta`; pull
  strength here just monotonically decays with distance instead.
  Achievable, but not implemented in v1 — see `weightForDistance()` in
  `worker-extra.ts` for where to add a tent shape if wanted.
  it as a future improvement.
- Only the *nearest* occupant per direction is considered, not every
  particle along the ray — a deliberate cost-bound, but it means a
  distant same-color friend can be "hidden" behind a closer rival on the
  same heading.
