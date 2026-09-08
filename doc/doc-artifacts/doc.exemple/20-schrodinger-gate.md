# Example 20 — Schrödinger Gate (quantum filter)

**Pitch:** Each tick the gate randomly *collapses* to ALLOW or BLOCK. Looking at it (lens scan / tooltip open) freezes the state. Signal receivers see flickering truth.

**Why it’s not trivial:** Uses `random`, `signals` sender that changes every pulse, `events` from Prospector’s Lens to “observe”, `structures.updateData` for collapsed flag, UI toast “Collapsed: ALLOW”. Comedy + actual logistics chaos.

**APIs:** structures, processing, signals, random, events, elements, i18n, lights

```js
const MOD = "weird.schrodinger";
const SID = `${MOD}.gate`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/qgate.png"); // ambiguous / allow / block

  api.structures.register({
    id: SID,
    nameKey: "mods|qgate|name",
    descriptionKey: "mods|qgate|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { collapsed: false, allow: true, observeMs: 0 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 16 } },
    spritesheet: { frameSize: { width: 16, height: 16 } },
  });
  api.player.buildings.unlockById(SID);
  api.signals.registerSenderType(SID, (s) => !!(s.data?.allow));

  // Observation from lens mod or any scan event
  api.events.on("hood.lens:scan", ({ cellX, cellY }) => {
    const s = api.structures.getAtCell(cellX, cellY);
    if (!s || !api.structures.isType(s, SID)) return;
    api.structures.updateData(s, {
      ...s.data,
      collapsed: true,
      observeMs: api.time.getElapsedMs() + 3000,
    });
    api.ui.toast({ key: s.data.allow ? "mods|qgate|allow" : "mods|qgate|block" });
  });

  api.structures.processing.register(`${SID}:tick`, {
    structureType: SID,
    intervalMs: 100,
    process: (s) => {
      const now = api.time.getElapsedMs();
      if (s.data.collapsed && now < (s.data.observeMs || 0)) {
        // frozen
        api.signals.setOutputAtCell(s.x, s.y, !!s.data.allow);
        api.structures.setSpritesheetIndex(s, s.data.allow ? 1 : 2);
        return;
      }
      // unobserved — superpose: reroll
      const allow = api.random.int(0, 1) === 1;
      api.structures.updateData(s, { ...s.data, collapsed: false, allow });
      api.signals.setOutputAtCell(s.x, s.y, allow);
      api.structures.setSpritesheetIndex(s, 0); // ambiguous frame

      const x = s.x, y = s.y - 1;
      if (!api.grid.isCellEmptyAtCell(x, y) && !allow) {
        api.elements.setVelocityAtCell(x, y, { x: api.random.float(-20, 20), y: -5 });
      }
    },
  });
}
```

**Player fantasy:** Wire it to a launcher clock and watch the factory become a coin flip.
