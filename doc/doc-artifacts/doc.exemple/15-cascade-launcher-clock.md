# Example 15 — Cascade Launcher Clock (must-have timing for press drops)

**Vibe:** Kinetic Press needs 25+ block drops. Players build tall launcher elevators. This **clock** pulses signal channels in sequence so staggered launcher columns don’t jam.

**APIs:** structures, signals, processing, triggers, placementConfig, sprites, lights, i18n

---

## Why it feels native

Wiki tip: angled launchers clear Press tops. Tall drop towers need **timing**. A 4-beat signal clock is the factory heart for synchronized lifts.

## Design

- `defaultData: { beat: 0, periodMs: 683 }` (683 ≈ vanilla launcher cadence)  
- Each tick: `beat = (beat+1)%4`, `setOutputAtCell` only when linked receivers match channel  
- Actually: four sender modes via `channel` placement field 0–3; clock sets global event; receivers filter  

Simpler approach: one clock structure emits signal on for 1 beat every `periodMs`, off otherwise — wire to launcher enable pads.

```js
const MOD = "hood.clock";
const SID = `${MOD}.core`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/clock.png"); // 4 frames

  api.structures.register({
    id: SID,
    nameKey: "mods|clock|name",
    descriptionKey: "mods|clock|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { beat: 0, onMs: 200, periodMs: 683 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 16 } },
    spritesheet: { frameSize: { width: 16, height: 16 } },
  });
  api.structures.registerPlacementConfig({
    structureId: SID,
    fields: [
      { type: "integer", id: "periodMs", label: "Period ms", default: 683, min: 200, max: 4000 },
      { type: "integer", id: "onMs", label: "Pulse width ms", default: 200, min: 50, max: 2000 },
    ],
  });
  api.player.buildings.unlockById(SID);
  api.signals.registerSenderType(SID, (s) => !!(s.data?.out));

  api.structures.processing.register(`${SID}:tick`, {
    structureType: SID,
    intervalMs: 50,
    process: (s) => {
      const period = s.data.periodMs || 683;
      const onMs = s.data.onMs || 200;
      const t = (api.time?.getElapsedMs?.() ?? Date.now()) % period;
      const out = t < onMs;
      const beat = Math.floor((t / period) * 4) % 4;
      api.structures.updateData(s, { ...s.data, out, beat });
      api.signals.setOutputAtCell(s.x, s.y, out);
      api.structures.setSpritesheetIndex(s, beat);
    },
  });
}
```

## Pairs with

Vanilla **Launcher** / **Mk2**; **Kinetic Press** drop towers; **Ex 01** pads; **Ex 06** belts.
