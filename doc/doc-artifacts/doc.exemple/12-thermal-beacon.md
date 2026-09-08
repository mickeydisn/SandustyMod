# Example 12 — Thermal Beacon (must-have for Flamethrower / Volcanizer setups)

**Vibe:** Place near burn lines and Thermal Buffer routes. Shows heat “mood” with 4 light colors and enables Burner-Belt-style logic when hot.

**APIs:** structures, processing, fire, elements, lights, signals, energy, events, sprites, ui

---

## Why it feels native

Wiki loop: Flamethrower burns Residue; Burner Belt needs heat through Thermal Buffer; Volcanizer makes lava. Players want a **visible heat node** they can signal-wire into logistics.

## Design

| Heat band | Sprite / light | Signal out |
|---|---|---|
| 0–24 | blue idle | off |
| 25–49 | yellow | on |
| 50–74 | orange | on |
| 75–100 | white-hot | on + event `hood.thermal:critical` |

Heat rises when fire/lava/steam is adjacent; falls slowly otherwise.

## Sketch

```js
const MOD = "hood.thermalBeacon";
const SID = `${MOD}.beacon`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/beacon.png"); // 4 frames

  api.structures.register({
    id: SID,
    nameKey: "mods|thermal|name",
    descriptionKey: "mods|thermal|desc",
    categoryKey: "power",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { heat: 0 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 16 } },
    spritesheet: { frameSize: { width: 16, height: 16 } },
  });
  api.player.buildings.unlockById(SID);
  api.signals.registerSenderType(SID, (s) => (s.data?.heat ?? 0) >= 25);

  api.structures.processing.register(`${SID}:sense`, {
    structureType: SID,
    intervalMs: 300,
    process: (s) => {
      let heat = s.data.heat ?? 0;
      const nbs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      let hot = false;
      for (const [dx, dy] of nbs) {
        const x = s.x + dx, y = s.y + dy;
        if (
          api.elements.isTypeAtCell(x, y, "fire") ||
          api.elements.isTypeAtCell(x, y, "flame") ||
          api.elements.isTypeAtCell(x, y, "lava") ||
          api.fire.canBurnElementAtCell(x, y)
        ) hot = true;
      }
      heat = hot ? Math.min(100, heat + 8) : Math.max(0, heat - 3);
      api.structures.updateData(s, { ...s.data, heat });
      api.structures.setSpritesheetIndexByValueAtCell(s.x, s.y, heat, [0, 25, 50, 75]);
      api.signals.setOutputAtCell(s.x, s.y, heat >= 25);

      const metrics = api.rendering?.getGridMetrics?.() || { cellSize: 4 };
      const wx = s.x * metrics.cellSize + 2;
      const wy = s.y * metrics.cellSize + 2;
      const color =
        heat >= 75 ? [1, 1, 0.9, 1] :
        heat >= 50 ? [1, 0.5, 0.1, 1] :
        heat >= 25 ? [1, 0.85, 0.2, 1] : [0.3, 0.5, 1, 1];
      api.lights.temporary.createAtWorld(wx, wy, {
        durationMs: 280, brightness: 0.4 + heat / 100, size: 40 + heat / 2, color,
      });

      if (heat >= 75) api.events.emit("hood.thermal:critical", { x: s.x, y: s.y, heat });
    },
  });
}
```

## Pairs with

Vanilla **Burner Belt**, **Flamethrower**, **Volcanizer**; signal into **Ex 03** reactor enable; **Ex 07** alarms.
