# Example 23 — Sandstorm Engine (particle hurricane)

**Pitch:** A core structure that periodically converts nearby sand-like elements into particles with chaotic velocities (`convertToParticleAtCell` + `addParticleVelocityAtCell`), then recongeals them. Signal strength scales radius.

**Why it’s not trivial:** Particle API mastery, radius iteration via `grid.forEachCellInCircle`, signal-modulated power, worker-heavy sim, danger to player (`isWithinRadiusOfCell`).

**APIs:** structures, processing, elements, signals, grid, random, lights, player, hooks

```js
const MOD = "weird.sandstorm";
const SID = `${MOD}.engine`;

export async function init({ api }) {
  await api.sprites.loadFromMod(`${SID}.img`, "assets/storm.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|storm|name",
    categoryKey: "production",
    buildModes: [{ type: "single" }],
    shape: [[1, 1], [1, 1]],
    defaultData: { power: 0 },
    render: { imageName: `${SID}.img`, size: { width: 32, height: 32 } },
  });
  api.player.buildings.unlockById(SID);

  api.signals.targets.register(SID, (s, payload) => {
    api.structures.updateData(s, {
      ...s.data,
      power: payload.combined ? payload.onCount || 1 : 0,
    }, { propagateToWorkers: true });
  });

  api.structures.processing.register(`${SID}:blow`, {
    structureType: SID,
    intervalMs: 400,
    process: (s) => {
      const power = s.data.power || 0;
      if (power <= 0) return;
      const radius = 2 + power * 2;
      api.grid.forEachCellInCircle?.(s.x, s.y, radius, (x, y) => {
        if (!api.elements.isTypeAtCell(x, y, "sand") &&
            !api.elements.isTypeAtCell(x, y, "sandium")) return;
        if (api.random.float(0, 1) > 0.3) return;
        const vx = api.random.float(-80, 80);
        const vy = api.random.float(-100, -10);
        api.elements.convertToParticleAtCell?.(x, y, { x: vx, y: vy });
        api.elements.addParticleVelocityAtCell?.(x, y, { x: vx, y: vy }, 120);
      });
      api.lights.temporary.createAtWorld(s.x * 4, s.y * 4, {
        durationMs: 300, brightness: 1, size: 40 + radius * 8,
        color: [0.9, 0.8, 0.5, 0.5],
      });
      if (api.player.isWithinRadiusOfCell(s.x, s.y, radius)) {
        api.player.setVelocity?.(api.random.float(-30, 30), api.random.float(-20, 0));
      }
    },
  });
}
```

**Player fantasy:** Weaponize the sand itself; accidentally yeet the Prospector.
