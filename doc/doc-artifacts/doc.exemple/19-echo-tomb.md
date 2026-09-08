# Example 19 — Echo Tomb (ghost river recorder)

**Pitch:** A mausoleum gate that *remembers* every element that falls through it for 30 seconds, then can replay that sequence out the other side — a portable ghost of your factory stream.

**Why it’s not trivial:** Combines `storage` ring-buffer, `processing`, `elements.createAtCell`/`getTypeAtCell`, `signals.interactables` (record/play modes), `time.getElapsedMs`, and event replay. You’re cloning *history*, not filtering live pixels.

**APIs:** structures, processing, elements, storage, signals, time, lights, sound, events, placementConfig

---

## Behavior

| Mode | How |
|---|---|
| **Record** (default) | Each tick, if element in intake cell → push `{ t, typeId }` into a circular buffer (max 256) |
| **Play** (signal on / interact toggle) | Pop schedule relative to play-start; spawn types at outlet with original gaps |
| **Clear** | Interact while crouched… or second interactable “seal” |

## Sketch

```js
const MOD = "weird.echoTomb";
const SID = `${MOD}.tomb`;
const KEY = `${MOD}.tape`;

export async function init({ api }) {
  api.storage.ensure(MOD);
  await api.sprites.loadFromMod(`${SID}.img`, "assets/tomb.png"); // sealed / open eyes frames

  api.structures.register({
    id: SID,
    nameKey: "mods|echoTomb|name",
    descriptionKey: "mods|echoTomb|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1], [1], [1]],
    defaultData: { mode: "record", playT0: 0, cursor: 0 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 48 } },
    spritesheet: { frameSize: { width: 16, height: 48 } },
  });
  api.player.buildings.unlockById(SID);

  api.signals.interactables.register(SID, (s) => {
    const mode = s.data.mode === "record" ? "play" : "record";
    const playT0 = api.time.getElapsedMs();
    api.structures.updateData(s, { ...s.data, mode, playT0, cursor: 0 });
    api.ui.toast({ key: mode === "play" ? "mods|echoTomb|playing" : "mods|echoTomb|recording" });
    api.structures.setSpritesheetIndex(s, mode === "play" ? 1 : 0);
  });

  api.structures.processing.register(`${SID}:tick`, {
    structureType: SID,
    intervalMs: 50,
    process: (s) => {
      const tape = api.storage.get(MOD, KEY) || [];
      const intake = { x: s.x, y: s.y - 1 };
      const outlet = { x: s.x, y: s.y + 3 };

      if (s.data.mode === "record") {
        const t = api.elements.getResolvedTypeAtCell(intake.x, intake.y);
        if (t == null) return;
        const typeId = api.elements.getIdByType(t);
        tape.push({ t: api.time.getElapsedMs(), typeId });
        if (tape.length > 256) tape.shift();
        api.storage.set(MOD, KEY, tape);
        // swallow original? optional removeAtCell for true "recording"
        return;
      }

      // play
      const t0 = s.data.playT0 || 0;
      const elapsed = api.time.getElapsedMs() - t0;
      let cursor = s.data.cursor || 0;
      while (cursor < tape.length) {
        const rel = tape[cursor].t - (tape[0]?.t || 0);
        if (rel > elapsed) break;
        if (api.grid.isCellEmptyAtCell(outlet.x, outlet.y)) {
          api.elements.createAtCell(outlet.x, outlet.y, tape[cursor].typeId, {});
        }
        cursor++;
      }
      api.structures.updateData(s, { ...s.data, cursor });
      if (cursor >= tape.length) {
        api.lights.temporary.createAtWorld(s.x * 4, s.y * 4, {
          durationMs: 400, brightness: 1.5, size: 60, color: [0.7, 0.9, 1, 1],
        });
      }
    },
  });
}
```

**Player fantasy:** “Save a perfect gold trickle, paste it into a new wing of the base.”
