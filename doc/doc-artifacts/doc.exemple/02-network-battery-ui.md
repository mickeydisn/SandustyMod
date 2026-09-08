# Example 02 — Network Battery + HUD Overlay

**APIs:** structures, energy, ui.overlays, rendering, events, triggers, i18n, player.buildings, sprites

**Idea:** Storage structure on the energy graph. A hotbar overlay shows network free capacity under the cursor. Periodic trigger refreshes the HUD.

---

## `main.js` (sketch)

```js
const MOD = "myMod.battery";
const SID = `${MOD}.cell`;
let hud = { capacity: 0, at: null };

export async function init(sandkit) {
  const { api } = sandkit;

  await api.sprites.loadFromMod(`${MOD}.img`, "assets/battery.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|battery|name",
    categoryKey: "power",
    buildModes: [{ type: "single" }],
    shape: [[1], [1]],
    defaultData: { charge: 0 },
    render: { imageName: `${MOD}.img`, size: { width: 16, height: 32 } },
  });
  api.energy.registerType(SID, "storage", { priority: 10 });
  api.player.buildings.unlockById(SID);

  // Overlay on hotbar slot
  api.ui.overlays.register("hotbar", `${MOD}.hud`, (ctx) => {
    if (!hud.at) return;
    const { x, y } = api.rendering.getDrawPositionAtCell(hud.at.x, hud.at.y);
    // draw capacity text using overlay context or DOM per your UI style
    api.ui.showTooltip?.(`Battery net free: ${hud.capacity}`);
  });

  api.triggers.register(`${MOD}:scan`, {
    intervalMs: 200,
    callback: () => {
      const cell = api.input.getMousePositionAtCell();
      const s = api.structures.getAtCell(cell.x, cell.y);
      if (!s || !api.structures.isType(s, SID)) {
        hud = { capacity: 0, at: null };
        return;
      }
      hud = {
        at: { x: s.x, y: s.y },
        capacity: api.energy.getNetworkFreeCapacityAtCell(s.x, s.y),
      };
    },
  });

  // Charge pulse when another mod emits energy deposit
  api.events.on("myMod.reactor:surplus", ({ amount }) => {
    const cell = api.input.getMousePositionAtCell();
    api.energy.addAtCell(cell.x, cell.y, amount, {});
  });
}
```

## Interactions

- Receives **Ex 03** surplus energy events.  
- **Ex 07 Dashboard** reads `getNetworkFreeCapacityAtCell` for the same cells.
