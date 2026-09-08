# Example 16 — Collector Resonance Plate (must-have economy feedback)

**Vibe:** Collectors are silent squares. This plate under/near collectors **sings** when gold value is present, shows ring light intensity by `collector.getValue*`, and optional toast when gold is spent (value drops).

**APIs:** structures, processing, collector, lights, sound, events, sprites, ui

---

## Why it feels native

Gold is *the* research currency. Players want audiovisual confirmation that Collectors are “live” without opening UI.

```js
const MOD = "hood.resonance";
const SID = `${MOD}.plate`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/plate.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|resonance|name",
    descriptionKey: "mods|resonance|desc",
    categoryKey: "economy",
    buildModes: [{ type: "rectangle", directions: ["horizontal", "vertical"] }],
    shape: [[1]],
    defaultData: { lastValue: 0 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 16 } },
  });
  api.player.buildings.unlockById(SID);

  api.structures.processing.register(`${SID}:hum`, {
    structureType: SID,
    intervalMs: 400,
    process: (s) => {
      // sample cell above plate for collectable gold
      const id = api.grid.getCellIdAtCell(s.x, s.y - 1);
      let value = 0;
      if (api.collector.isCellIdCollectable(id)) {
        value = api.collector.getValueFromCellId(id);
      }
      // also sum network of nearby collectors loosely via events
      const prev = s.data.lastValue || 0;
      if (value < prev - 5) {
        api.events.emit("hood.resonance:spent", { x: s.x, y: s.y, delta: prev - value });
        api.sound.play("ui.coins", api.sound.calculateDistanceOptionsAtWorld(s.x * 4, s.y * 4, 1));
      }
      api.structures.updateData(s, { ...s.data, lastValue: value });
      if (value > 0) {
        api.lights.temporary.createAtWorld(s.x * 4 + 2, s.y * 4 + 2, {
          durationMs: 350,
          brightness: Math.min(2, 0.3 + value / 50),
          size: 30 + Math.min(80, value),
          color: [1, 0.85, 0.2, 1],
        });
      }
    },
  });
}
```

## Pairs with

Vanilla **Collector**; research spends; **Ex 07** economy graph.
