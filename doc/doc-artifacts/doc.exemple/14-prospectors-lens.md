# Example 14 — Prospector’s Lens (must-have Grabber-adjacent tool)

**Vibe:** Wiki mentions Material Scanner upgrade for Grabber. This mod adds a **hotbar tool** that raycasts and toasts what you are looking at (element/terrain/structure) with i18n names — essential for learning recipes.

**APIs:** items, sprites, input, raycast, elements, terrains, structures, ui, i18n, cooldown, sound, rendering

---

## Why it feels native

New players don’t know Residue vs Burnt Residue vs Cinder. A dedicated “identify” tool matches the Prospect *fantasy* and the scanner upgrade lore.

## Sketch

```js
const MOD = "hood.lens";
const ITEM = `${MOD}.tool`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${MOD}.icon`, "assets/lens.png");
  api.i18n.register("en", {
    "mods|lens|name": "Prospector's Lens",
    "mods|lens|empty": "Nothing here",
    "mods|lens|info": "{kind}: {name}",
  });

  api.items.register({
    id: ITEM,
    nameKey: "mods|lens|name",
    sprite: { id: `${MOD}.icon` },
  });
  api.player.inventory.addById(ITEM);

  const cd = {};
  api.events.on("item:used", ({ itemId }) => {
    if (itemId !== ITEM) return;
    if (!api.cooldown.isReady(cd, 200)) return;
    api.cooldown.start(cd);

    const eye = api.player.getPositionAtWorld();
    const aim = api.input.getMousePositionAtWorld();
    const ang = api.utils.getAngle(eye, aim);
    const hit = api.raycast.castAtWorld(eye.x, eye.y, ang, 350);
    if (!hit) {
      api.ui.toast({ key: "mods|lens|empty" });
      return;
    }

    const { cellX, cellY } = hit;
    let kind = "Empty", name = "—";
    const st = api.structures.getAtCell(cellX, cellY);
    if (st) {
      kind = "Structure";
      name = api.structures.getDefinitionByType(st.type)?.nameKey
        || String(st.type);
    } else if (api.terrains.isAtCell(cellX, cellY)) {
      kind = "Terrain";
      const t = api.terrains.getTypeAtCell(cellX, cellY);
      name = api.i18n.getName?.(t) || String(t);
    } else if (api.elements.getResolvedTypeAtCell(cellX, cellY) != null) {
      kind = "Element";
      const t = api.elements.getResolvedTypeAtCell(cellX, cellY);
      name = api.elements.getNameByType?.(t) || String(t);
    }

    api.ui.toast({ key: "mods|lens|info" /* params: kind, name */ });
    api.sound.play("ui.click", api.sound.calculateDistanceOptionsAtWorld(eye.x, eye.y, 0.6));

    // highlight
    const { cellSize } = api.rendering.getGridMetrics();
    api.lights.temporary.createAtWorld(
      cellX * cellSize + cellSize / 2,
      cellY * cellSize + cellSize / 2,
      { durationMs: 250, size: 28, brightness: 1.4, color: [0.3, 1, 1, 1] },
    );
    api.events.emit("hood.lens:scan", { cellX, cellY, kind, name });
  });
}
```

## Pairs with

Vanilla **Grabber** scanner fantasy; Ex **07** can log scans; great for **Ex 05** alchemy learning.
