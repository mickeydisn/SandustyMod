# Example 28 — Blood Moon Director (world event auteur)

**Pitch:** A rare global event (every N minutes, or forced by shrine). During blood moon: `hooks` amplify fire, `reactions` path feels different (temp register), sky lights tint via many temporary lights on player, maps markers, ambient sound layers. Ends cleanly.

**Why it’s not trivial:** Timed global state in shared buffer, multi-system takeover (fire, lights, sound, hooks, events), cinematic camera, safe cleanup — a *director*, not a building.

**APIs:** triggers, shared.buffers, hooks, fire, lights, sound, events, player, time, ui, random

```js
const MOD = "weird.bloodMoon";
const FLAG = `${MOD}.flags`; // [active, endTick]

export async function init({ api }) {
  api.shared.buffers.ensure(FLAG, { type: "uint32", length: 2 });
  api.workers.setPostUpdateEnabled?.(true);

  const startMoon = () => {
    const buf = api.shared.buffers.get(FLAG);
    buf[0] = 1;
    buf[1] = (api.time.getTick?.() || 0) + 60 * 30; // ~30s if 60tps-ish — tune
    api.ui.toast({ key: "mods|blood|start" });
    api.sound.playLayers?.([{ id: "ambient.omen" }, { id: "music.lowdrone" }]);
    api.events.emit("weird.bloodMoon:start");
  };

  api.triggers.register(`${MOD}:schedule`, {
    intervalMs: 5 * 60 * 1000,
    callback: () => {
      if (api.random.float(0, 1) < 0.4) startMoon();
    },
  });

  // Force via event from prophecy winner etc.
  api.events.on("weird.prophecy:winner", () => {
    if (api.random.int(0, 2) === 0) startMoon();
  });

  api.triggers.register(`${MOD}:direct`, {
    intervalMs: 200,
    callback: () => {
      const buf = api.shared.buffers.get(FLAG);
      if (!buf[0]) return;
      const tick = api.time.getTick?.() || 0;
      if (tick > buf[1]) {
        buf[0] = 0;
        api.ui.toast({ key: "mods|blood|end" });
        api.events.emit("weird.bloodMoon:end");
        return;
      }
      const p = api.player.getPositionAtWorld();
      api.lights.temporary.createAtWorld(p.x, p.y, {
        durationMs: 220, brightness: 0.5, size: 160, color: [0.7, 0.05, 0.1, 1],
      });
    },
  });

  api.hooks.intercept?.("element:burn", (payload, ctx) => {
    const buf = api.shared.buffers.get(FLAG);
    if (!buf[0]) return;
    // during moon: allow burn always — or force ignite nearby
  });

  // Worker-side optional: more fire spread on update:post when flag set
}
```

**Player fantasy:** The planet itself becomes a character; other mods can react to `bloodMoon:start`.
