# Example 21 — Pixel Sommelier (aging barrels)

**Pitch:** Sealed barrels that *age* elements using `setDurationAtCell` + long processing. Wet sand aged 60s becomes a custom `vintageSlurry` with higher collector value. Interact to “uncork.”

**Why it’s not trivial:** Time-gated transform, custom element register, discoveries on first uncork, locked interactable while aging, lights that warm with age.

**APIs:** elements, structures, processing, signals.interactables, discoveries, collector-related flags, time, lights, i18n

```js
const MOD = "weird.sommelier";
const BARREL = `${MOD}.barrel`;
const VINTAGE = `${MOD}.vintageSlurry`;

export async function init({ api }) {
  api.elements.register({
    id: VINTAGE,
    nameKey: "mods|sommelier|vintage",
    density: 140,
    isTransportable: true,
    collectable: true,
  });

  await api.sprites.loadFromMod(`${BARREL}.img`, "assets/barrel.png"); // empty / aging / ready

  api.structures.register({
    id: BARREL,
    nameKey: "mods|sommelier|barrel",
    categoryKey: "production",
    buildModes: [{ type: "single" }],
    shape: [[1], [1]],
    defaultData: { stage: "empty", startMs: 0, ageMs: 45000 },
    render: { imageName: `${BARREL}.img`, size: { width: 16, height: 32 } },
    spritesheet: { frameSize: { width: 16, height: 32 } },
  });
  api.player.buildings.unlockById(BARREL);

  api.structures.processing.register(`${BARREL}:age`, {
    structureType: BARREL,
    intervalMs: 500,
    process: (s) => {
      if (s.data.stage === "empty") {
        if (api.elements.isTypeAtCell(s.x, s.y - 1, "wetSand")) {
          api.elements.removeAtCell(s.x, s.y - 1);
          api.structures.updateData(s, {
            stage: "aging",
            startMs: api.time.getElapsedMs(),
          });
          api.structures.setSpritesheetIndex(s, 1);
        }
        return;
      }
      if (s.data.stage === "aging") {
        const age = api.time.getElapsedMs() - (s.data.startMs || 0);
        const ready = age >= (s.data.ageMs || 45000);
        api.lights.temporary.createAtWorld(s.x * 4, s.y * 4, {
          durationMs: 400,
          brightness: 0.3 + age / 100000,
          size: 24,
          color: [0.6, 0.3, 0.1, 1],
        });
        if (ready) {
          api.structures.updateData(s, { ...s.data, stage: "ready" });
          api.structures.setSpritesheetIndex(s, 2);
          api.sound.play?.("cork.creak");
        }
      }
    },
  });

  api.signals.interactables.register(BARREL, (s) => {
    if (s.data.stage !== "ready") {
      api.ui.toast({ key: "mods|sommelier|wait" });
      return;
    }
    if (!api.grid.isCellEmptyAtCell(s.x, s.y + 2)) return;
    api.elements.createAtCell(s.x, s.y + 2, VINTAGE, {});
    const type = api.elements.getTypeById(VINTAGE);
    if (type != null) api.discoveries.addElementByType(type);
    api.structures.updateData(s, { ...s.data, stage: "empty" });
    api.structures.setSpritesheetIndex(s, 0);
    api.events.emit("weird.sommelier:uncorked", { x: s.x, y: s.y });
  });
}
```

**Player fantasy:** A ridiculous wine cellar wing in a sand factory.
