# Example 03 — Overheat Reactor (Main register + Worker process)

**APIs:** structures, processing, elements, grid, events, hooks, signals, energy, lights, ui, worker entry

**Idea:** Machine consumes water, outputs steam, stores heat in `data`. Overheat emits event + forces nearby State Pads (Ex 01). Worker runs the dangerous cell writes.

---

## `modinfo.json`

```json
{
  "manifestVersion": 1,
  "id": "myMod.reactor",
  "name": "Reactor",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "main.js",
  "workerEntry": "worker.js"
}
```

## `main.js`

```js
const MOD = "myMod.reactor";
const SID = `${MOD}.core`;

export async function init(sandkit) {
  const { api } = sandkit;

  await api.sprites.loadFromMod(`${MOD}.img`, "assets/reactor.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|reactor|name",
    categoryKey: "production",
    buildModes: [{ type: "single" }],
    shape: [[1, 1], [1, 1]],
    defaultData: { heat: 0, enabled: true },
    render: { imageName: `${MOD}.img`, size: { width: 32, height: 32 } },
  });
  api.energy.registerType(SID, "storage", { priority: 3 });
  api.player.buildings.unlockById(SID);

  api.structures.processing.register(`${SID}:tick`, {
    structureType: SID,
    intervalMs: 500,
    process: (structure, context) => {
      if (!structure.data?.enabled) return;
      if (!context.isEnabledAtCell(structure.x, structure.y)) return;

      // Ask worker to transform cells (via event); main only adjusts heat UI data
      api.events.emit(`${MOD}:tick`, { x: structure.x, y: structure.y });
    },
  });

  api.signals.targets.register(SID, (structure, payload) => {
    api.structures.updateData(structure, {
      ...structure.data,
      enabled: payload.combined,
    }, { propagateToWorkers: true });
  });

  api.events.on(`${MOD}:heat`, ({ x, y, heat }) => {
    const s = api.structures.getAtCell(x, y);
    if (!s) return;
    api.structures.updateData(s, { ...s.data, heat });
    api.structures.setSpritesheetIndexByValueAtCell(x, y, heat, [0, 25, 50, 75]);
    if (heat >= 80) {
      api.ui.toast({ key: "mods|reactor|overheat" });
      api.events.emit(`${MOD}:overheat`, { x, y, heat });
      api.events.emit("myMod.reactor:surplus", { amount: 15 });
      // Notify state pads
      api.events.emit("myMod.statePad:changed", { x, y, state: 4, source: "reactor" });
    }
  });
}
```

## `worker.js`

```js
const MOD = "myMod.reactor";

export function init(sandkit) {
  const { api } = sandkit;

  api.events.on(`${MOD}:tick`, ({ x, y }) => {
    // Immediate worker writes: eat water above, spawn steam
    const above = y - 1;
    if (api.elements.isTypeAtCell(x, above, "water")) {
      api.elements.removeAtCell(x, above);
      api.elements.createAtCell(x, y - 2, "steam", { durationTicks: 90 });
      api.events.emit(`${MOD}:heat`, { x, y, heat: 10 }); // main aggregates
    } else {
      api.events.emit(`${MOD}:heat`, { x, y, heat: 5 });
    }
  });
}
```

## Interactions

- Signal-powered via **Ex 01 / logic**.  
- Surplus → **Ex 02** batteries.  
- Overheat → **Ex 07** alarms + **Ex 01** state.
