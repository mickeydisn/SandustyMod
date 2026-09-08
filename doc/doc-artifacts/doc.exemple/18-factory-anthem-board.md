# Example 18 — Factory Anthem Board (must-have celebration UI)

**Vibe:** Viability Tiers (shake wet sand, press residue, grow flowers…). When factory process counts cross milestones, the board plays fanfare, camera nods to a structure, and a persistent plaque updates.

**APIs:** factory, ui, events, triggers, camera, sound, storage, structures.forEachOfType, i18n, progression

---

## Why it feels native

Tier checks are easy to miss. A physical **plaque building** + toast fanfare makes progression *feel* like Sandustry’s planetary milestones.

```js
const MOD = "hood.anthem";
const SID = `${MOD}.plaque`;
const MILESTONES = [
  { processId: "shakeWetSand", at: 4000, key: "tier1" },
  { processId: "pressBurntResidue", at: 3000, key: "tier2" },
  { processId: "growFlowers", at: 4000, key: "tier3" },
  { processId: "condenseFlorin", at: 10000, key: "tier4" },
];

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/plaque.png");
  api.storage.ensure(MOD);
  const cleared = api.storage.get(MOD, "cleared") || {};

  api.structures.register({
    id: SID,
    nameKey: "mods|anthem|name",
    descriptionKey: "mods|anthem|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1, 1], [1, 1]],
    defaultData: { lastTier: "" },
    render: { imageName: `${SID}.img`, size: { width: 32, height: 32 } },
  });
  api.player.buildings.unlockById(SID);

  api.triggers.register(`${MOD}:poll`, {
    intervalMs: 2000,
    callback: () => {
      for (const m of MILESTONES) {
        if (cleared[m.key]) continue;
        const n = api.factory.getProcessCount(m.processId);
        if (n < m.at) continue;
        cleared[m.key] = true;
        api.storage.set(MOD, "cleared", cleared);
        api.ui.toast({ key: `mods|anthem|${m.key}` });
        api.sound.play("fanfare.tier");
        api.events.emit("hood.anthem:milestone", m);

        // focus first plaque
        api.structures.forEachOfType(SID, (s) => {
          api.structures.updateData(s, { ...s.data, lastTier: m.key });
          const cs = api.rendering.getGridMetrics().cellSize;
          api.camera.setFocusAtWorld(s.x * cs, s.y * cs);
          api.schedule.nextTick(() => api.camera.releaseFocus({ durationMs: 600 }));
        });
      }
    },
  });
}
```

## Pairs with

Vanilla **Viability Tiers**; **Ex 07** dashboard; whole factory fantasy.
