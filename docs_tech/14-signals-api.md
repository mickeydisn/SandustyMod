# Signal wiring & `api.signals` — senders, receivers, links, targets

Reference for the game's **signal logic-modelling system**: how a structure can
*turn on/off* other structures, wire them together in the world, andre-act to
combined inputsждый. This powers the vanilla Signal Linker tool, Signal
Switch, filters, doors, etc.

> Verified against `__bundel/bundel.js` (signals module **63133-63650**, public
> `api.signals.targets.register` wiring **52475-52496**) and `packages/sandkit/
> src/sandkit/api/signals.d.ts`. **Important caveat:** in the 1.0 bundle the
> *public* `sandkit.api.signals` surface exposes `targets.register` only; the full
> field/link/interactable helpers live behind the engine (`FH.signals`, assignments
> at **63276-63291**) and are what the shipped `signals.d.ts` doc-comments describe
> by name. Both layers are covered below, marked **[public]** / **[engine/internal]**.



## 1. The mental model (four pieces)

| Piece | Role | Example |
|---|---|---|
| **Sender** | a structure that *outputs* a signal — its output is evaluated per frame | Sensor, Thermal status, a lever's `data.on` |
| **Wire / link** | a directed `from → to` connection drawn in the world | created by the Signal Linker item |
| **Receiver** | a structure that *listens* to incoming wires and applies to its behaviour | Door, Shaker, machine inputs, Filter |
| **Target** | the registered behaviour for a receiver **structure type** | `api.signals.targets.register(myType, apply)` |

A **signal is boolean** — a wire is either **`on`** or **`off`**. The system also
tracks three numbers per receiver (see §4). No "value" flows, only on/off.



Concrete picture (vanilla Signal Switch, bundle 128524-128541) — each switch
keeps `data.defaultOpen` and a wire-drawn "on" state, and clicking it (wired via
an interactable handler) toggles that state.**

---

## 2. The engine's per-session state

On the **main thread** the signals system owns an object
(`session.mods.signals`, seeded from the persistent `storage "signals"`, 63160-63185)
with **persisted** + **runtime** fields:

| field | persisted | meaning |
|---|---|---|
| `links` | ✅ |the wire map: `"<sx>,<sy>" → [ { x,y,on }, … ]` — each sender cell lists its outgoing wires. |
| `hideWires` | ✅ |whether the wires are drawn (toggled by the hotbar overlay button) |
| `pendingLink` | ❌ |the Signal Linker's in-progress first click (sender being chosen) |
| `senderTypes` | ❌ |runtime `Set` of structure types that can **emit** (registered via `registerSenderType`) |
| `senderOutputGetters` | ❌ |`Map<type,(state, structure) => boolean>` — how to compute each sender's on/off |
| `receiverTypes` | ❌ |`Set` of structure types that **receive** (auto-added by `targets.register`) |
| `receiverApply` | ❌ |`Map<type,(state, structure, payload) => void>` —the registered target handlers |
| `interactableHandlers` | ❌ |`Map<type,(state, structure) => void>` — click handlers (see doc 13 B3) |
| `incomingByReceiver` | ❌ |rebuilt from `links` each change: `"<rx>,<ry>" → [ {x,y,on} ]` (63150-63158) |
| `dirtyReceivers` | ❌ |receiver cells needing re-application this frame |
| `lastApplied*` | ❌ |cached last `combined/inputCount/onCount` per receiver (dedup fires) |

> `links` + `hideWires` persist to save-file storage; everything else is
> derived runtime state..

---

## 3. What a "signal" computes — the three values per receiver

Each frame the propagation pass `v(e)` (63228-63274) processes every **dirty**
receiver, re-reads its **incoming wires**,and computes three numbers:

| value | meaning |
|---|---|
| `inputCount` | total incoming **wires** pointing at the receiver |
| `onCount` | of those, how many are **`on`** |
| `combined` | `onCount > 0` — **any-on → on** (OR-semantics per receiver) |

These are cached per receiver (`lastAppliedCombined/InputCount/OnCount`,dragging 63256-63260);
a target handler is only re-invoked when one of the three actually changed
(same-frame wiring changes → automatically **bumped dirty**).

A **sender's** on/off itself is computed by (in priority order, `U`, 63196-63210):

1. a registered **`senderOutputGetter`** for its type (live callback`);
2. else its `data.on` **if `data.on` is a boolean`;
3. else `true` if any of its *outgoing links* are on (`some(e => e.on))`) —
   a sender can chain/relay..

---

## 4. `api.signals.targets.register(structureType, apply)` — [public verified]

The **only** member verified on the public `sandkit.api.signals` surface in the
1.0 bundle(52475-52496, d.ts:30-46).

```ts
sandkit.api.signals.targets.register(structureTypeOrId, apply);
```

| Param | meaning |
|---|---|
| `structureTypeOrId` |the receiver structure **type id** (or its numeric enum). Strings are resolved via `resolveTypeName` (52494). |
| `apply` | `(state, structure, payload) => void` — invoked when a signal reaches a matching structure & one of the three values changed. |

**Payload** (the bundle builds it at 63264-63269):

```ts
apply(state, structure, {
  combined: boolean,    // onCount > 0  (any wire on)
  inputCount: number,   // total incoming wires
  onCount: number,      // how many of them are on
});
```

Registering a target **auto-adds** that type to `receiverTypes`, stores the apply in
`receiverApply`,and triggers the rebuild of incoming links(52490-52492,, 63292). So you
just declare "structures of type X respond to signals like this"and the engine
wires everything else..

> Register **before** signals are initialized throws (`Signals must be initialized
> before registering targets`,, 52486). In practice this means register targets
> during your `main()` set-up (the signals module is wired at game ready,, not
> deep inside a `game:ready` race. Simplest: call it top-level in `main` like
> the vanilla mods do..

---

## 5. The fuller signals surface (documented names, engine-backed)

The shipped `signals.d.ts` doc-comments name the rest of the intended API surface
(these names are what the engine exposes behind `FH.signals`, assignments
63276-63291). Whether each is directly reachable as `sandkit.api.signals.*`
depends on your engine build — the 1.0 bundled exposed only `targets.register`.
Treat these as "the signals vocabulary" and use whatever your build's types
expose:

| member (documented / engine `FH.signals`) | meaning |
|---|---|
| `signals.targets.register(type, apply)` — [public] | register a receiver behaviour (§4) |
| `signals.interactables.register(type_, handler)` | wire a **click** handler (toggle/act) for a structure type; it feeds the `interactableHandlers` map (d.ts:8-14 , 63175) |
| `signals.registerSenderType(type_, getter)` | mark a type as a **sender** and give an on/off getter (d.ts:16-21; stored in `senderTypes`+`senderOutputGetters`, 63179-63204) |
| `signals.setOutputAtCell(x_, y_, on)` / `set` / `setAll` | force a cell's outgoing wire state (the Sensor example in d.ts:23-27; see `FH.signals.set`, 63281-63282) |
| `signals.getCombinedAt / getIncomingCountAt / getOnCountAt` | read a receiver's current computed signal values (63283-63285) |
| `signals.link / unlink / unlinkAllAt / hasLink` | manage wires programmatically (63286-63288; see §6) |
| `signals.getAnchorPoint / drawWireSegment` | wire geometry / custom wire drawing hooks (63290-63291) |

**Which is which for your structure?** — the taxonomy:

- **Receiver →** `targets.register` (declarative behaviour) — plus your handler
  reads `structure.data` to decide.
- **Sender →** `registerSenderType(type_, getter(state_, structure_) => boolean)` —
  or simply **store a boolean `data.on`** on the structure and skip the getter (the
  engine falls back to it, 63205-63206).
- **Clickable →** `interactables.register(type_, handler)` — toggle `data.on` etc.
- **Wrapped / pure box →** nothing needed — it just forwards wires.



---

## 6. Working recipe — a "switch → machine" chain

```ts
// 1) the output switch (a sender via data.on)
sandkit.api.structures.register({
  id: "myMod:switch", /* name, render, ... */
  defaultData: { on: false },
  // ...
});

// 2) the machine (a receiver — handles whatever signal arrives)
sandkit.api.structures.register({
  id: "myMod:machine", /* name, categoryKey, ... */
  // a target handler makes it "on" when any signal is on
});

// 3) wire it all together: a sender type + a target handler
api.signals.registerSenderType?.("myMod:switch", (state, structure) => !!structure.data.on);
api.signals.interactables?.register?.("myMod:switch", (state, structure) => {  // click to flip
  structure.data.on = !structure.data.on;
  api.structures.update?.(structure);
});
api.signals.targets.register("myMod:machine", (state, structure, payload) => {
  api.structures.processing.setEnabledAt?.(structure.x, structure.y, payload.combined);
});
```

Player flow: **Signal Linker** → click the switch (sender corner, wire to the
machine, wire), then click items.with optional sections for custom getters/gates.

---

## 7. Q&A

### Q1. Can a signal carry a *value* (e.g. 0–100), not just on/off?
**No.** A signal/wire is boolean — it's `on` or `off` only (63196-63210). There
is no magnitude flowing over wires. If you need a value, encode it as multiple
wires (one per bit/threshold) or read `structure.data` directly on your target
handler instead of relying on the wire's on/off.

### Q2. Is `combined` OR or AND across the incoming wires?
**OR.** `combined = onCount > 0` (63255). Any single wire on turns the receiver
"on". If you need AND/N-of-M semantics, use `onCount` vs `inputCount` in your
handler — e.g. `payload.onCount === payload.inputCount` is "all on", `>= 2` is
"at least two", etc.

### Q3. When exactly is my `apply` handler called?
Only when one of the three computed values (`combined`, `inputCount`, `onCount`)
**changed** since the last application (63256-63260), during the per-frame pass
`v(e)` run on `frame:update` (63293-63295). So it's **edge-triggered**, not
called every frame just because a wire is on. Good for idempotent behaviours like
enabling/disabling a machine.

### Q4. Do I need a target registration for a **sender**?
No — senders add nothing to `targets`. A sender: mark it via
`registerSenderType(type, getter)` or just store a boolean `data.on` (the
engine falls back ath 63205-63206). Neither requires `targets.register`.

### Q5. Can the same structure be **both** sender and receiver?
Yes — the system separates the roles into separate maps. Register a target (to
receive) and optionally a senderType (to emit) — the same id works in both

### Q6. How do wires get created by the player?
Via the **Signal Linker** item/tool. The engine keeps a `pendingLink` (first
click = choose the sender corner) and wires on the second click; it also refuses
interactables while the linker is active (63326-63327). Mods don't have to
implement wiring — they just document which types relevant via sender/
interactable/target registrations.



### Q7. `interactables.register` vs the `action:start` hook — which do I use?
`interactables.register(type, handler)` is the **signals-native** click wiring: it
draws the hover-highlight box (63461-63480)and the engine **cancels** the default
action for you (63331-63333), with the demolisher/marquee/linker guards built
in. Use it when your click behaviour is a simple signals toggle. Use a raw
`hooks.intercept("action:start", …)` (doc 13 B1) when you need full
control (payload args, ordering, custom cancel logic) that the signals layer
doesn't expose.,

### Q8. Why "Signals must be initialized before registering targets" error?
The signals module is only built once `session.mods.signals` exists (63167-63185),
which happens when the signals **mod component** initializes (at game ready。。 Register
`targets` at load-time in `main()`, not inside a callback that could fire before
that init— that's when vanilla mods register them.



### Q9. Do my structures persist their signal state?
`links` + `hideWires` persist (via `storage "signals"`,, 63160-63162). The
`data.on` of each structure persists if you put it in `defaultData`. The
runtime maps (`senderTypes`, `interactableHandlers`, incoming rebuilds, cached
values等) are re-derived each session — you re-register types in `main` each
load.



### Q10. Where do wires draw, and can I hide them?
The engine draws wires each `frame:render` in the overlay context (63336-63482),
skipped when `hideWires` is true. The vanilla **hotbar signals overlay** has a
"show/hide wires" button (`ui.overlays.register(...,"signals",…)`,ierung 63486-
63513) toggling that flag..

---

## 8. Cheat-sheet (one-liners`

**I want a structure to react to a wire:** — `targets.register(type, apply)` (§4)
**I want a structure to output a signal:** — registerSenderType getter, or `data.on`
**I want a click to toggle my structure:** — `interactables.register(type, handler)`
**I want to read a receiver's current value:** — `getCombinedAt/getIncomingCountAt/getOnCountAt`
**I want programmatic wiring:** — `link/unlink/unlinkAllAt/hasLink`
**Signals js boolean, edge-triggered, OR-combined.:** — use `onCount/inputCount` for richer logic。