# @sandmd/controls

Control structures, signal wiring, conditions, and triggers for Sandusty-style mods. Controls bind
in-game structures (buttons, toggles, displays, LEDs, gauges, ranges, selectors, D-pads, text,
counters) to a `PathStore` that reads and writes one shared config state — typically a `JsonBuffer`
from `@sandmd/buffer`.

Everything calls `sandkit.api.*` directly (typed by `@sandmd/mysandkit`); there are no host
abstractions to pass around.

## Install / import

```ts
import {
  ControlSystem,
  evaluateCondition,
  PathStore,
  pathStoreFromRecord,
  registerConditionTile,
  registerResourceSignalTile,
  SignalBus,
  TriggerScheduler,
  WorkerTick,
} from "@sandmd/controls";
```

## Quick start

```ts
import { ControlSystem, createControlSystem } from "@sandmd/controls";
import { JsonBuffer } from "@sandmd/buffer";

// One shared config store (main + worker threads).
const store = pathStoreFromRecord(
  new JsonBuffer<{ light: boolean; gain: number }>("my-mod", "config", { light: false, gain: 5 }),
);

// Bind world controls to that store.
const controls = new ControlSystem(store);
controls.registerToggle("light", {
  id: "my-mod/toggle",
  name: "Switch",
  spriteId: "my-mod/toggle",
});
controls.registerDisplay("gain", {
  id: "my-mod/display",
  name: "Gain",
  spriteId: "my-mod/display",
});

// Use the store programmatically.
controls.set("light", true);
console.log(controls.get("gain"));
```

## API

### Store

- `class PathStore` — wraps a `JsonBuffer`-like record (`getPath`/`setPath`/`commit`) into a typed
  `get`/`set`/`subscribe` store.
- `pathStoreFromRecord(record)` — build a `PathStore` from a record.
- `createControlSystem(record)` — build a `ControlSystem` straight from a record.

### Control system

- `class ControlSystem` — the main entry. `new ControlSystem(store)` exposes `.store`, `get`/`set`,
  and one `registerXxx` per control type: `registerButton`, `registerToggle`, `registerSelector`,
  `registerRange`, `registerLed`, `registerGauge`, `registerDpad`, `registerText`,
  `registerCounter`, `registerDisplay`.
- Each `registerXxx(path, options)` returns a `RegisteredControl`
  (`{ structureId, path, setValue, getValue }`).

Options per control (subset):

- **Button** — `mode: "set" | "pulse" | "increment"`, `pressValue`, `pulseMs`, `incrementBy`
- **Toggle** — `onValue`/`offValue`, `accumulate`
- **Selector** — `options[]`, `exclusive`, `cycleOnClick`
- **Range** — `min`, `max`, `step`, `initial`, `layout: "single" | "triple"`
- **Gauge** — `min`, `max`, `steps`, `signalOutput`
- **LED** — `onWhen`, `signalOutput`
- **Display** — `mode`, `thresholds`, `signalOutput`
- **D-pad** — `pathX`, `pathY`, `cycleOnClick`
- **Text** — `promptTitle`, `promptMessage`

### Signals

- `class SignalBus` — wires `sandkit.api.signals` and `sandkit.api.structures.processing` into
  `onInteract`, `onPulse`, `emit`, `registerSource`, `registerProcessing`, `wireOutput`, and the
  `wireAndGate` / `wireOrGate` / `wireNotGate` gates.
- `andSignals(...)` / `orSignals(...)` — combine `readOn` predicates.

### Conditions

- `evaluateCondition(rule, current)` — pure `CompareOp` check (`eq` `neq` `gt` `gte` `lt` `lte`
  `truthy` `falsy`).
- `registerConditionTile(options)` — a world tile that compares a config path each tick and emits
  `signal` on a `SignalBus`.

### Resources

- `registerResourceSignalTile(options)` — a tile that signals when a resource amount (`getAmount()`)
  is `>= threshold`.

### Triggers

- `class TriggerScheduler` — `register(id, intervalMs, tick)` calls `sandkit.api.triggers` directly.

### Worker

- `class WorkerTick` — thin per-tick wrapper around a buffer record.

## Example

See [`exemple/main.ts`](./exemple/main.ts) for a control system over a fake record, individual
`registerButton`/`registerToggle`/`registerRange` calls, a signal bus with an AND gate, a condition
tile, a resource signal tile, a trigger scheduler, and a worker tick.
