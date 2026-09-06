/**
 * @sandmd/controls — control structures, signals, conditions, triggers.
 *
 * Controls bind game structures (buttons, toggles, displays, LEDs, gauges…) to
 * a PathStore over a JsonBuffer, so the world can read and write one shared
 * config state. This example also shows the signal bus, condition tile,
 * resource signal tile, and trigger scheduler helpers.
 *
 *   deno check packages/controls/exemple/main.ts
 */

import "@sandmd/sandkit";
import {
  ControlSystem,
  evaluateCondition,
  pathStoreFromRecord,
  registerConditionTile,
  registerResourceSignalTile,
  SignalBus,
  TriggerScheduler,
  WorkerTick,
} from "@sandmd/controls";

const MOD_ID = "controls-example";

/** Minimal `JsonBuffer`-like record so `pathStoreFromRecord` has something to drive. */
function fakeRecord(initial: Record<string, unknown>) {
  const cache = structuredClone(initial);
  return {
    getPath(path: string): unknown {
      const parts = path.split(".");
      let cur: unknown = cache;
      for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
      return cur;
    },
    setPath(path: string, value: unknown): void {
      const parts = path.split(".");
      let cur = cache as Record<string, unknown>;
      for (const p of parts.slice(0, -1)) {
        cur = (cur[p] as Record<string, unknown>) ?? (cur[p] = {});
      }
      cur[parts[parts.length - 1]!] = value;
    },
    commit(): void {},
    sync(): void {},
  };
}

/**
 * Tiny stand-in for the game host so this example runs outside Sandustry.
 * In a real mod you don't create this — `sandkit` is provided by the game and
 * every call below is a direct `sandkit.api.*` call.
 */
function stubSandkit(): typeof sandkit {
  const structures = new Map<
    string,
    Array<{ x: number; y: number; data: Record<string, unknown> }>
  >();
  return {
    react: {} as never,
    enums: { ActionType: { Building: {} } },
    api: {
      structures: {
        register: (_def: unknown) => {},
        update: (_s: { data: Record<string, unknown> }, _o?: Record<string, unknown>) => {},
        setData: (s: { data: Record<string, unknown> }, partial: Record<string, unknown>) => {
          Object.assign(s.data, partial);
        },
        processing: {
          register: (_t: string, _d: unknown) => {},
        },
        forEachOfType: (
          type: string,
          cb: (s: { x: number; y: number; data: Record<string, unknown> }) => void,
        ) => {
          for (const s of structures.get(type) ?? []) cb(s);
        },
      },
      signals: {
        interactables: { register: (_t: string, _h: unknown) => {} },
        targets: { register: (_t: string, _h: unknown) => {} },
        sources: {
          set: (_s: { data: Record<string, unknown> }, on: boolean) => console.log("emit", on),
        },
        links: { poll: () => {} },
      },
      triggers: {
        register: (_id: string, def: { intervalMs: number }) => {
          console.log("registered trigger", def.intervalMs);
        },
      },
      ui: {
        prompt: (_o: unknown, cb: (value: string | null) => void) => cb(null),
      },
    },
  } as unknown as typeof sandkit;
}
globalThis.sandkit = stubSandkit();

/** 1. Control system: bind world controls to one shared store. */
function exempleControlSystem() {
  const controls = new ControlSystem(pathStoreFromRecord(fakeRecord({ light: false, gain: 5 })));

  controls.registerToggle("light", {
    id: `${MOD_ID}/toggle`,
    name: "Light switch",
    spriteId: `${MOD_ID}/toggle`,
  });
  controls.registerDisplay("gain", {
    id: `${MOD_ID}/display`,
    name: "Gain",
    spriteId: `${MOD_ID}/display`,
  });
  controls.registerButton("gain", {
    id: `${MOD_ID}/plus`,
    name: "+1",
    spriteId: `${MOD_ID}/plus`,
    mode: "increment",
  });
  controls.registerRange("gain", {
    id: `${MOD_ID}/volume`,
    name: "Volume",
    spriteId: `${MOD_ID}/volume`,
    min: 0,
    max: 10,
  });
  controls.registerLed("light", {
    id: `${MOD_ID}/led`,
    name: "Light LED",
    spriteId: `${MOD_ID}/led`,
  });
  controls.registerCounter("gain", {
    id: `${MOD_ID}/counter`,
    name: "Gain counter",
    spriteId: `${MOD_ID}/counter`,
  });

  // Programmatic writes flow through the store and refresh bound structures.
  controls.set("light", true);
  controls.set("gain", 7);
  console.log("gain is", controls.get("gain"));
}

/** 2. Signal bus: wire outputs, sources, and AND gates (via sandkit.api directly). */
function exempleSignalBus() {
  const bus = new SignalBus();

  // Read structure.data.on every 120 ms and push it out as a signal.
  bus.wireOutput(`${MOD_ID}/lever`, (s) => Boolean(s.data.on), 120);

  // AND of two boolean reads on another type.
  bus.wireAndGate(`${MOD_ID}/and`, [(s) => Boolean(s.data.a), (s) => Boolean(s.data.b)]);

  // Register a ticking signal source.
  bus.registerSource({
    typeId: `${MOD_ID}/sensor`,
    readOn: (s) => Number(s.data.level ?? 0) > 50,
    intervalMs: 200,
  });

  // React to a click on a structure type.
  bus.onInteract(`${MOD_ID}/lever`, (s) => console.log("lever clicked", s.x, s.y));

  return bus;
}

/** 3. Condition tile: evaluate a rule + register a signal tile over a record. */
function exempleCondition(bus: SignalBus) {
  const record = fakeRecord({ pressure: 12 });

  // Pure predicate check — usable anywhere.
  console.log(
    "pressure > 10?",
    evaluateCondition({ path: "pressure", op: "gt", value: 10 }, record.getPath("pressure")),
  );

  // A world tile that compares a config path every tick and emits its signal.
  registerConditionTile({
    modId: MOD_ID,
    typeId: `${MOD_ID}/pressure-ok`,
    name: "Pressure OK",
    record,
    rule: { path: "pressure", op: "lte", value: 20 },
    signalBus: bus,
  });
}

/** 4. Resource signal tile: signal on when a resource is above a threshold. */
function exempleResourceSignalTile(bus: SignalBus) {
  registerResourceSignalTile({
    modId: MOD_ID,
    typeId: `${MOD_ID}/coal-low`,
    name: "Coal low",
    getAmount: () => (Math.random() > 0.5 ? 30 : 5),
    threshold: 25,
    signalBus: bus,
  });
}

/** 5. Trigger scheduler: register periodic callbacks the game ticks. */
function exempleTriggers() {
  const scheduler = new TriggerScheduler();
  scheduler.register(`${MOD_ID}/cleanup`, 5000, () => console.log("cleanup tick"));
}

/** 6. Worker tick: thin per-tick wrapper over a buffer record. */
function exempleWorker() {
  const loop = new WorkerTick({
    record: {
      get: (path: string) => (path === "n" ? 1 : undefined),
      set: (_path: string, _value: unknown) => {},
      commit: () => console.log("committed"),
    },
    run: (r) => r.set("n", Number(r.get("n")) + 1),
  });
  loop.tick();
}

try {
  exempleControlSystem();
  const bus = exempleSignalBus();
  exempleCondition(bus);
  exempleResourceSignalTile(bus);
  exempleTriggers();
  exempleWorker();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
}
