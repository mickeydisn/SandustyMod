# Example 09 — Weather System (hooks + shared buffer + multi-worker)

**APIs:** hooks, events, elements, terrains, shared.buffers, worker, workers, random, lights, triggers

**Idea:** Global “rain” flag in a SharedArrayBuffer. Workers shard vertical strips; on post-update, randomly convert steam→water in their strip. Main toggles weather from a structure lever and drives ambient lights.

---

## `main.js`

```js
const MOD = "myMod.weather";
const BUF = `${MOD}.flags`; // index 0 = rain on/off

export async function init(sandkit) {
  const { api } = sandkit;

  api.shared.buffers.ensure(BUF, { type: "uint32", length: 4 });
  api.workers.setPostUpdateEnabled(true);

  const LEVER = `${MOD}.lever`;
  await api.sprites.loadFromMod(`${LEVER}.img`, "assets/lever.png");
  api.structures.register({
    id: LEVER,
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { on: false },
    render: { imageName: `${LEVER}.img`, size: { width: 16, height: 16 } },
  });
  api.player.buildings.unlockById(LEVER);

  api.signals.interactables.register(LEVER, (structure) => {
    const on = !structure.data.on;
    api.structures.updateData(structure, { ...structure.data, on });
    const buf = api.shared.buffers.get(BUF);
    buf[0] = on ? 1 : 0;
    api.events.emit(`${MOD}:toggle`, { on });
    api.ui.toast({ key: on ? "mods|weather|rainOn" : "mods|weather|rainOff" });
  });

  api.events.on(`${MOD}:toggle`, ({ on }) => {
    if (!on) return;
    // ambient flash
    const p = api.player.getPositionAtWorld();
    api.lights.temporary.createAtWorld(p.x, p.y, {
      durationMs: 200, brightness: 0.6, size: 200, color: [0.6, 0.7, 1, 1],
    });
  });
}
```

## `worker.js`

```js
const MOD = "myMod.weather";
const BUF = `${MOD}.flags`;

export function init(sandkit) {
  const { api } = sandkit;
  const buf = api.shared.buffers.require?.(BUF) || api.shared.buffers.get(BUF);

  api.events.on("update:post", () => {
    if (!buf || !buf[0]) return;
    const idx = api.worker.getIndex();
    const n = api.worker.getCount();
    const { widthCells, heightCells } = api.grid.getDimensions();
    const x0 = Math.floor((widthCells * idx) / n);
    const x1 = Math.floor((widthCells * (idx + 1)) / n);

    for (let i = 0; i < 8; i++) {
      const x = api.random.int(x0, Math.max(x0, x1 - 1));
      const y = api.random.int(0, heightCells - 1);
      if (api.elements.isTypeAtCell(x, y, "steam")) {
        api.elements.replaceAtCell(x, y, "water", {});
      }
    }
  });

  // Optional: block some fires while raining
  api.hooks.intercept("element:burn", (payload, ctx) => {
    if (buf?.[0]) ctx?.cancel?.();
  });
}
```

## Interactions

- Lever can be signal-linked like **Ex 01**.  
- Rain feeds water for **Ex 03** reactor.  
- **Ex 07** listens `${MOD}:toggle`.
