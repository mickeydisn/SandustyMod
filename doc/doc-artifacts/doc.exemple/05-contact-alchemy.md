# Example 05 — Contact Alchemy (reactions + discoveries + filter UI flag)

**APIs:** reactions, elements, discoveries, events, i18n, structures (optional catalyst pad)

**Idea:** New element `myMod.catalystDust`. Water + dust → steam + null. Discovering the element unlocks codex. A catalyst structure speeds reactions by emitting local events.

---

## `main.js`

```js
const MOD = "myMod.alchemy";
const DUST = `${MOD}.catalystDust`;

export async function init(sandkit) {
  const { api } = sandkit;

  api.elements.register({
    id: DUST,
    nameKey: "mods|alchemy|dust|name",
    density: 80,
    isTransportable: true,
    collectable: true,
    showInFilterPicker: true,
  });

  api.reactions.registerContact({
    inputA: "water",
    inputB: DUST,
    outputA: "steam",
    outputB: null,
    orientation: "any",
  });

  // When player first picks up dust type
  api.events.on("item:used", () => {}); // optional

  api.hooks.modify?.("element:move", (payload) => payload);

  // Discover on first create from our catalyst machine event
  api.events.on(`${MOD}:produced`, ({ type }) => {
    const t = api.elements.getTypeById(type);
    if (t != null) api.discoveries.addElementByType(t);
  });

  // Catalyst pad drops dust into the world on interact
  await api.sprites.loadFromMod(`${MOD}.pad`, "assets/pad.png");
  const SID = `${MOD}.pad`;
  api.structures.register({
    id: SID,
    nameKey: "mods|alchemy|pad|name",
    categoryKey: "production",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { stock: 20 },
    render: { imageName: `${MOD}.pad`, size: { width: 16, height: 16 } },
  });
  api.player.buildings.unlockById(SID);

  api.signals.interactables.register(SID, (structure) => {
    if ((structure.data.stock ?? 0) <= 0) {
      api.ui.toast({ key: "mods|alchemy|empty" });
      return;
    }
    const x = structure.x;
    const y = structure.y - 1;
    api.grid.mutate((w) => {
      w.elements.createAtCell(x, y, DUST, {});
    });
    api.structures.updateData(structure, {
      ...structure.data,
      stock: structure.data.stock - 1,
    });
    api.events.emit(`${MOD}:produced`, { type: DUST, x, y });
  });
}
```

## Interactions

- Dust transportable on **Ex 06** belts.  
- Steam feeds **Ex 03** reactor.  
- Discoveries show in **Ex 07** codex panel.
