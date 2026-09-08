# Example 13 — Seed Nursery Projector (Planter Box companion)

**Vibe:** After Kinetic Press drops Seeds, players route them to Planter Boxes for flowers → gold/Amethelis. This building **spotlights** dry vs wet seed piles and gently launches seeds toward a configured facing.

**APIs:** structures, processing, elements, launchers behavior, placementConfig, sprites, i18n, lights, events

---

## Why it feels native

Wiki: Planter Box grows Wet Seeds → Flower → Gold + Amethelis. Seed handling is fiddly on belts. A “nursery” that only touches seed types is a natural mid-game quality-of-life building.

## Design

- Placement field: `facing` = left | right | up  
- Process: if seed/wetSeed on top → apply soft velocity in facing direction  
- Lights soft green when seeds present, pink when wet seeds present  
- Emits `hood.nursery:seedMoved` for dashboards  

## Sketch

```js
const MOD = "hood.nursery";
const SID = `${MOD}.projector`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/nursery.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|nursery|name",
    descriptionKey: "mods|nursery|desc",
    categoryKey: "production",
    buildModes: [{ type: "single" }],
    shape: [[1, 1], [1, 1]],
    defaultData: { facing: "right", moved: 0 },
    render: { imageName: `${SID}.img`, size: { width: 32, height: 32 } },
  });

  api.structures.registerPlacementConfig({
    structureId: SID,
    fields: [{
      type: "choice",
      id: "facing",
      label: "Launch toward",
      default: "right",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
        { value: "up", label: "Up" },
      ],
    }],
  });

  api.player.buildings.unlockById(SID);

  const vel = {
    left:  { x: -30, y: -8 },
    right: { x:  30, y: -8 },
    up:    { x:   0, y: -40 },
  };

  api.structures.processing.register(`${SID}:push`, {
    structureType: SID,
    intervalMs: 220,
    process: (s) => {
      const x = s.x, y = s.y - 1;
      const seed =
        api.elements.isTypeAtCell(x, y, "seed") ||
        api.elements.isTypeAtCell(x, y, "wetSeed") ||
        api.elements.isTypeAtCell(x, y, "seedling");
      if (!seed) return;
      const v = vel[s.data.facing] || vel.right;
      api.elements.setVelocityAtCell(x, y, v);
      s.data.moved = (s.data.moved || 0) + 1;
      api.structures.updateData(s, s.data);
      api.events.emit("hood.nursery:seedMoved", { x, y, facing: s.data.facing });
      const wet = api.elements.isTypeAtCell(x, y, "wetSeed");
      api.lights.temporary.createAtWorld(x * 4, y * 4, {
        durationMs: 120, size: 36, brightness: 0.9,
        color: wet ? [1, 0.5, 0.8, 1] : [0.4, 1, 0.5, 1],
      });
    },
  });
}
```

## Pairs with

Vanilla **Planter Box**, **Kinetic Press**, **Launcher**; Ex **06** belts.
