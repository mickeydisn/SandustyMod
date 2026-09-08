# Example 04 — Terraformer Tool (item + raycast + excavation + patterns + cooldown)

**APIs:** items, sprites, input, raycast, patterns, excavation, terrains, elements, grid, cooldown, energy, resources, sound, i18n

**Idea:** Hold tool, press binding, raycast to a cell, dig a circle, convert terrain to sand, spend energy, play positional sound.

---

## `main.js`

```js
const MOD = "myMod.terraformer";
const ITEM = `${MOD}.tool`;
const PROFILE = `${MOD}:blast`;

export async function init(sandkit) {
  const { api } = sandkit;

  await api.sprites.loadFromMod(`${MOD}.icon`, "assets/tool.png");

  api.excavation.registerProfile(PROFILE, {
    power: 12,
    options: { fromGun: true },
    terrainRules: [
      {
        cellType: api.terrains.getTypeById("dune"),
        outputElementType: api.elements.getTypeById("sand"),
      },
      {
        cellType: api.terrains.getTypeById("stone"),
        damage: 20,
      },
    ],
  });

  api.items.register({
    id: ITEM,
    nameKey: "mods|terraformer|name",
    sprite: { id: `${MOD}.icon` },
  });
  api.player.inventory.addById(ITEM);

  const cooldown = {};
  api.input.registerBinding(`${MOD}.fire`, ["KeyF"], {
    nameKey: "mods|terraformer|bind",
  });

  api.events.on("item:used", ({ itemId }) => {
    if (itemId !== ITEM) return;
    fire(api, cooldown);
  });

  // Also allow key while item active
  api.triggers.register(`${MOD}:key`, {
    intervalMs: 50,
    callback: () => {
      if (!api.items.isActiveById(ITEM)) return;
      // poll binding edge yourself or rely on item:used
    },
  });
}

function fire(api, cooldown) {
  if (!api.cooldown.isReady(cooldown, 800)) return;
  const mouse = api.input.getMousePositionAtWorld();
  const player = api.player.getPositionAtWorld();
  const angle = api.utils.getAngle(player, mouse);
  const hit = api.raycast.castAtWorld(player.x, player.y, angle, 400);
  if (!hit) return;

  const ok = api.resources.adjustEnergy
    ? (api.energy.consume?.(20) ?? true)
    : true;
  if (!ok) {
    api.ui.toast({ key: "mods|terraformer|noEnergy" });
    return;
  }

  api.patterns.excavateAtCell(
    hit.cellX, hit.cellY,
    api.patterns.createCircle(5),
    { x: 0, y: -120 },
    8,
  );

  api.sound.play(
    "myMod.blast",
    api.sound.calculateDistanceOptionsAtWorld(
      hit.cellX * 4, hit.cellY * 4, 1,
    ),
  );
  api.cooldown.start(cooldown);
  api.events.emit(`${MOD}:blast`, { cellX: hit.cellX, cellY: hit.cellY });
}
```

## Interactions

- Spends energy from **Ex 02/03** networks.  
- **Ex 07** counts `${MOD}:blast` events.  
- **Ex 09** reaction can turn excavated sand into special powder.
