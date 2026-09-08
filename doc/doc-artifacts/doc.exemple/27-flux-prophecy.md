# Example 27 — Flux Prophecy (factory lottery)

**Pitch:** Shrine consumes energy bids from linked batteries. Every 60s a winner channel is rolled (`random` + shared buffer). Winning signal line pulses hard; losers get smoke. Jackpot event grants temporary process rate toast / fake “blessing.”

**Why it’s not trivial:** Multi-structure ritual, energy.consume, shared buffer ceremony state machine, dramatic lights/camera, social nonsense in singleplayer.

**APIs:** structures, energy, signals, random, shared.buffers, triggers, lights, camera, sound, ui, events

```js
const MOD = "weird.prophecy";
const SHRINE = `${MOD}.shrine`;
const STATE = `${MOD}.state`; // [phase, winner, tickAcc]

export async function init({ api }) {
  api.shared.buffers.ensure(STATE, { type: "uint32", length: 4 });
  await api.sprites.loadFromMod(`${SHRINE}.img`, "assets/shrine.png");

  api.structures.register({
    id: SHRINE,
    nameKey: "mods|prophecy|name",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1, 1], [1, 1]],
    defaultData: { channel: 1 },
    render: { imageName: `${SHRINE}.img`, size: { width: 32, height: 32 } },
  });
  api.structures.registerPlacementConfig({
    structureId: SHRINE,
    fields: [{ type: "integer", id: "channel", label: "Faction", default: 1, min: 1, max: 4 }],
  });
  api.player.buildings.unlockById(SHRINE);
  api.signals.registerSenderType(SHRINE, (s) => {
    const st = api.shared.buffers.get(STATE);
    return st[1] === (s.data.channel || 1);
  });

  api.triggers.register(`${MOD}:rite`, {
    intervalMs: 60000,
    callback: () => {
      // bid: try consume energy at each shrine cell
      const alive = [];
      api.structures.forEachOfType(SHRINE, (s) => {
        const ok = api.energy.consume?.(10);
        if (ok !== false) alive.push(s.data.channel || 1);
        api.lights.temporary.createAtWorld(s.x * 4, s.y * 4, {
          durationMs: 500, brightness: 1.2, size: 50, color: [0.4, 1, 0.9, 1],
        });
      });
      if (!alive.length) {
        api.ui.toast({ key: "mods|prophecy|noBid" });
        return;
      }
      const winner = alive[api.random.int(0, alive.length - 1)];
      const st = api.shared.buffers.get(STATE);
      st[1] = winner;
      api.structures.forEachOfType(SHRINE, (s) => {
        const win = (s.data.channel || 1) === winner;
        api.signals.setOutputAtCell(s.x, s.y, win);
        if (win) {
          const cs = api.rendering.getGridMetrics().cellSize;
          api.camera.setFocusAtWorld(s.x * cs, s.y * cs);
          api.schedule.nextTick(() => api.camera.releaseFocus({ durationMs: 800 }));
          api.sound.play("fanfare.tier");
        }
      });
      api.ui.toast({ key: "mods|prophecy|winner" });
      api.events.emit("weird.prophecy:winner", { channel: winner });
    },
  });
}
```

**Player fantasy:** Gambling cult in the logistics wing.
