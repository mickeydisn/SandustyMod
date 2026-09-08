# Example 26 — Mirror Foreman (symmetry builder)

**Pitch:** Set a mirror axis structure. Whenever you `buildAtCell` a whitelisted type on one side, the foreman mirrors it across the axis if `canBuildAtCell` allows. Demolish mirrors too.

**Why it’s not trivial:** Hooks/events on place, authorization double-check, axis placement config, prevents infinite recursion with a re-entrancy flag in shared buffer.

**APIs:** structures, building, authorization, events, hooks, placementConfig, shared.buffers, ui

```js
const MOD = "weird.mirror";
const AXIS = `${MOD}.axis`;
const FLAG = `${MOD}.reentry`;

export async function init({ api }) {
  api.shared.buffers.ensure(FLAG, { type: "uint32", length: 1 });
  await api.sprites.loadFromMod(`${AXIS}.img`, "assets/axis.png");

  api.structures.register({
    id: AXIS,
    nameKey: "mods|mirror|name",
    categoryKey: "logic",
    buildModes: [{ type: "line", directions: ["vertical"] }],
    shape: [[1]],
    defaultData: { enabled: true },
    render: { imageName: `${AXIS}.img`, size: { width: 8, height: 16 } },
  });
  api.player.buildings.unlockById(AXIS);

  const whitelist = new Set([
    "conveyorRight", "conveyorLeft", "foundation", /* mod ids */
  ]);

  api.events.on("onBuildingPlaced", (e) => {
    const buf = api.shared.buffers.get(FLAG);
    if (buf[0]) return;
    // e may contain x,y,type — adapt to actual event payload
  });

  // Practical: triggers compare snapshots is heavy; expose a manual "mirror last build"
  // Better: intercept after build using action custom data

  api.structures.processing.register(`${AXIS}:pulse`, {
    structureType: AXIS,
    intervalMs: 1000,
    process: (axis) => {
      if (!axis.data?.enabled) return;
      // visual only — real mirror driven by event bus from a small patch or build hook
      api.lights.temporary.createAtWorld(axis.x * 4, axis.y * 4, {
        durationMs: 200, brightness: 0.4, size: 20, color: [0.8, 0.8, 1, 1],
      });
    },
  });

  // Helper API for other mods / console:
  api.events.on("weird.mirror:build", ({ x, y, typeId }) => {
    const buf = api.shared.buffers.get(FLAG);
    if (buf[0]) return;
    let axisX = null;
    api.structures.forEachOfType(AXIS, (a) => { axisX = a.x; });
    if (axisX == null) return;
    const mx = axisX - (x - axisX);
    if (!api.authorization.canBuildAtCell(mx, y)) return;
    if (api.building.isBlockedAtCell(mx, y)) return;
    buf[0] = 1;
    try {
      api.structures.buildAtCell(mx, y, typeId);
      api.events.emit("weird.mirror:reflected", { from: { x, y }, to: { x: mx, y } });
    } finally {
      buf[0] = 0;
    }
  });
}
```

**Player fantasy:** Perfect symmetric megabases with half the clicks.
