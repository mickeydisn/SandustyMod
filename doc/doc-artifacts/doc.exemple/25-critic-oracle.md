# Example 25 — The Critic (insulting factory coach)

**Pitch:** A structure that samples `factory.getProcessRate` / counts and `forEachOfType` belt counts, then delivers savage or glowing toasts on a timer. Mood sprite faces. Can be silenced with a signal.

**Why it’s not trivial:** Emergent personality from live metrics, storage of “grudge” score, i18n pools of lines, camera glance at problem areas.

**APIs:** factory, structures, triggers, ui, i18n, signals, camera, storage, sound

```js
const MOD = "weird.critic";
const SID = `${MOD}.bust`;

const PRAISE = ["mods|critic|p1", "mods|critic|p2"];
const ROAST = ["mods|critic|r1", "mods|critic|r2", "mods|critic|r3"];

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/critic.png"); // smile / frown
  api.storage.ensure(MOD);

  api.structures.register({
    id: SID,
    nameKey: "mods|critic|name",
    descriptionKey: "mods|critic|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1], [1]],
    defaultData: { muted: false },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 32 } },
    spritesheet: { frameSize: { width: 16, height: 32 } },
  });
  api.player.buildings.unlockById(SID);
  api.signals.targets.register(SID, (s, p) => {
    api.structures.updateData(s, { ...s.data, muted: !p.combined });
  });

  api.triggers.register(`${MOD}:judge`, {
    intervalMs: 15000,
    callback: () => {
      let muted = true;
      let bust = null;
      api.structures.forEachOfType(SID, (s) => {
        if (!s.data?.muted) muted = false;
        bust = s;
      });
      if (muted || !bust) return;

      const shake = api.factory.getProcessRate("shakeWetSand") || 0;
      const press = api.factory.getProcessCount("pressBurntResidue") || 0;
      const score = shake * 10 + press;
      const grudge = (api.storage.get(MOD, "grudge") || 0) + (score < 5 ? 1 : -1);
      api.storage.set(MOD, "grudge", Math.max(0, grudge));

      const happy = score > 20 && grudge < 3;
      api.structures.setSpritesheetIndex(bust, happy ? 0 : 1);
      const pool = happy ? PRAISE : ROAST;
      const key = pool[api.random.int(0, pool.length - 1)];
      api.ui.toast({ key });
      api.sound.play(happy ? "ui.chime" : "ui.buzz");

      if (!happy) {
        const cs = api.rendering.getGridMetrics().cellSize;
        api.camera.setFocusAtWorld(bust.x * cs, bust.y * cs);
        api.schedule.nextTick(() => api.camera.releaseFocus({ durationMs: 500 }));
      }
      api.events.emit("weird.critic:verdict", { happy, score, grudge });
    },
  });
}
```

**Player fantasy:** An NPC judge living in your base. Players *will* screenshot the roasts.
