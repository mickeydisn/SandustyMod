# Example 17 — Rift Drill (late-game energy digger)

**Vibe:** Wiki Drill needs energy + hard materials. This tool is a **charged beam**: hold to raycast, spend energy, excavate with a custom profile that prefers Crackstone/Obsidian-style hardness, leaves basalt residue flavor.

**APIs:** items, sprites, excavation, patterns, raycast, energy, resources, cooldown, projectiles (optional bolt), sound, lights, upgrades

---

## Why it feels native

Gun → Rocket → Drill progression. A modded “Rift Drill” with charge meter and flux-style lights fits Tier 3+ fantasy without replacing vanilla Drill.

```js
const MOD = "hood.riftDrill";
const ITEM = `${MOD}.item`;
const PROFILE = `${MOD}:bore`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${MOD}.icon`, "assets/rift_drill.png");

  api.excavation.registerProfile(PROFILE, {
    power: 20,
    options: { fromDrill: true, drillTierDamage: 2 },
    terrainRules: [
      { cellType: api.terrains.getTypeById("stone"), damage: 25 },
      { cellType: api.terrains.getTypeById("obsidian"), damage: 15 },
      { cellType: api.terrains.getTypeById("crackstone"), damage: 40 },
    ],
  });

  api.items.register({
    id: ITEM,
    nameKey: "mods|rift|name",
    sprite: { id: `${MOD}.icon` },
  });
  api.player.inventory.addById(ITEM);

  // Gate behind tech if desired
  // api.tech.conservatory.appendUnlock(DrillTech, { items: [ITEM] });

  const cd = {};
  api.events.on("item:used", ({ itemId }) => {
    if (itemId !== ITEM) return;
    if (!api.cooldown.isReady(cd, 400)) return;

    const spent = api.energy.consume?.(35);
    if (spent === false) {
      api.ui.toast({ key: "mods|rift|noPower" });
      return;
    }

    const eye = api.player.getPositionAtWorld();
    const aim = api.input.getMousePositionAtWorld();
    const ang = api.utils.getAngle(eye, aim);
    const hit = api.raycast.castAtWorld(eye.x, eye.y, ang, 280);
    if (!hit) return;

    api.patterns.excavateAtCell(
      hit.cellX, hit.cellY,
      api.patterns.createCircle(3),
      { x: Math.cos(ang) * 60, y: Math.sin(ang) * 60 },
      14,
    );

    api.lights.temporary.createAtWorld(
      hit.cellX * 4, hit.cellY * 4,
      { durationMs: 180, brightness: 2, size: 50, color: [0.6, 0.2, 1, 1] },
    );
    api.sound.play("drill.pulse", api.sound.calculateDistanceOptionsAtWorld(eye.x, eye.y, 1));
    api.cooldown.start(cd);
    api.events.emit("hood.rift:bore", { cellX: hit.cellX, cellY: hit.cellY });
  });

  api.upgrades.registerCategory({ id: `${MOD}.upg`, nameKey: "mods|rift|upg" });
  api.upgrades.register({
    itemId: ITEM,
    upgradeId: "boreWidth",
    maxLevel: 3,
    costs: [200, 400, 800],
  });
}
```

## Pairs with

Vanilla **Drill**, **Florinol Battery**, **Ex 02** batteries; purple VFX matches void/gloom biome fantasy.
