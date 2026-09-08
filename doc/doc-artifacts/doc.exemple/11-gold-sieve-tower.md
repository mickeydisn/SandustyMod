# Example 11 — Gold Sieve Tower (must-have early logistics)

**Vibe:** Sits next to Shakers / Kinetic Presses. Tall column that only keeps gold-like elements and ejects junk sideways with a soft launcher pulse.

**APIs:** structures, processing, elements, structureBehaviors (launcher), signals, sprites, lights, player.buildings, i18n, energy

---

## Why it feels native

Vanilla gold loops: Wet Sand → Shaker → Residue → burn → Press → Gold + Seeds.  
Players constantly dig through mixed piles. This tower is the “keep gold, kick sand” building they’d expect in logistics research.

## Design

| Slot | Behavior |
|---|---|
| Top intake cell | Reads element type |
| Gold / Liquid Gold | Passes down |
| Everything else | Nudged to side with velocity + brief light flash |
| Signal off | Pauses sorting (piles buffer on top) |

## `main.js` sketch

```js
const MOD = "hood.sieveTower";
const SID = `${MOD}.tower`;

export async function init({ api }) {
  api.i18n.register("en", {
    "mods|sieve|name": "Gold Sieve Tower",
    "mods|sieve|desc": "Drops gold downward. Kicks other solids sideways.",
  });

  await api.sprites.loadFromMod(`${SID}.img`, "assets/sieve.png"); // 16×48, 3 heat frames

  api.structures.register({
    id: SID,
    nameKey: "mods|sieve|name",
    descriptionKey: "mods|sieve|desc",
    categoryKey: "logistics",
    order: 25,
    buildModes: [{ type: "single" }],
    shape: [[1], [1], [1]],
    defaultData: { enabled: true, kicks: 0 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 48 } },
    spritesheet: { frameSize: { width: 16, height: 48 } },
  });

  api.player.buildings.unlockById(SID);
  // Optional: api.tech.conservatory.appendUnlock(LogisticsTech, { structures: [SID] });

  api.signals.targets.register(SID, (s, payload) => {
    api.structures.updateData(s, { ...s.data, enabled: payload.combined }, {
      propagateToWorkers: true,
    });
  });

  api.structures.processing.register(`${SID}:sort`, {
    structureType: SID,
    intervalMs: 150,
    process: (structure, ctx) => {
      if (!structure.data?.enabled) return;
      const x = structure.x;
      const yTop = structure.y - 1; // cell above tower
      if (ctx.isCellEmptyAtCell(x, yTop)) return;

      const isGold =
        api.elements.isTypeAtCell(x, yTop, "gold") ||
        api.elements.isTypeAtCell(x, yTop, "liquidGold");

      if (isGold) {
        // let gravity + open shaft handle it; sparkle
        return;
      }

      // kick sideways (away from factory center — use fixed +x)
      api.elements.addParticleVelocityAtCell?.(x, yTop, { x: 40, y: -10 }, 80);
      api.elements.setVelocityAtCell(x, yTop, { x: 36, y: -6 });
      structure.data.kicks = (structure.data.kicks || 0) + 1;
      api.structures.updateData(structure, structure.data);
      api.structures.setSpritesheetIndexByValueAtCell(
        structure.x, structure.y, structure.data.kicks % 3, [0, 1, 2],
      );
    },
  });
}
```

## Looks

- Tall slim sprite, gold rim when kicking  
- Tiny spark particle / temporary light on kick  
- Tooltip: `kicks` counter via `tooltipHover` data fields  

## Pairs with

Vanilla **Shaker**, **Collector**, **Conveyor**; Ex **06** filter belts; Ex **07** dashboard.
