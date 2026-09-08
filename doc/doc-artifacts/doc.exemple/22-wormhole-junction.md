# Example 22 — Wormhole Junction (paired teleporters)

**Pitch:** Place two junctions with the same `channel` (1–8). Elements entering A appear at B (and vice versa) via `teleportBetweenCells` / create+remove. Overload if both ends receive same tick — rift flash + random exit.

**Why it’s not trivial:** Placement config channels, `forEachOfType` pairing, worker-safe teleport, shared buffer lock to prevent double-eat, lights/sfx on transit.

**APIs:** structures, processing, elements, placementConfig, shared.buffers, lights, sound, events, random

```js
const MOD = "weird.wormhole";
const SID = `${MOD}.gate`;
const LOCK = `${MOD}.lock`;

export async function init({ api }) {
  api.shared.buffers.ensure(LOCK, { type: "uint32", length: 8 }); // per channel lock tick
  await api.sprites.loadFromMod(`${SID}.img`, "assets/wormhole.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|wormhole|name",
    categoryKey: "logistics",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { channel: 1 },
    render: { imageName: `${SID}.img`, size: { width: 16, height: 16 } },
  });
  api.structures.registerPlacementConfig({
    structureId: SID,
    fields: [{
      type: "integer", id: "channel", label: "Channel", default: 1, min: 1, max: 8,
    }],
  });
  api.player.buildings.unlockById(SID);

  api.structures.processing.register(`${SID}:rift`, {
    structureType: SID,
    intervalMs: 50,
    process: (s) => {
      const ch = (s.data.channel || 1) - 1;
      const lock = api.shared.buffers.get(LOCK);
      const tick = api.time.getTick?.() ?? 0;
      if (lock[ch] === tick) return; // already handled this channel this tick

      const mates = [];
      api.structures.forEachOfType(SID, (o) => {
        if (o.data?.channel === s.data.channel) mates.push(o);
      });
      if (mates.length < 2) return;
      const other = mates.find((o) => o.x !== s.x || o.y !== s.y);
      if (!other) return;

      const inX = s.x, inY = s.y - 1;
      const outX = other.x, outY = other.y - 1;
      if (api.grid.isCellEmptyAtCell(inX, inY)) return;
      if (!api.grid.isCellEmptyAtCell(outX, outY)) {
        // overload — fling randomly
        api.elements.setVelocityAtCell(inX, inY, {
          x: api.random.float(-50, 50),
          y: api.random.float(-50, 0),
        });
        api.events.emit("weird.wormhole:overload", { channel: s.data.channel });
        return;
      }

      lock[ch] = tick;
      if (api.elements.teleportBetweenCells) {
        api.elements.teleportBetweenCells(inX, inY, outX, outY);
      } else {
        const t = api.elements.getResolvedTypeAtCell(inX, inY);
        const id = api.elements.getIdByType(t);
        api.elements.removeAtCell(inX, inY);
        api.elements.createAtCell(outX, outY, id, {});
      }
      api.lights.temporary.createAtWorld(s.x * 4, s.y * 4, {
        durationMs: 80, brightness: 2, size: 40, color: [0.5, 0, 1, 1],
      });
      api.lights.temporary.createAtWorld(other.x * 4, other.y * 4, {
        durationMs: 80, brightness: 2, size: 40, color: [0.5, 0, 1, 1],
      });
    },
  });
}
```

**Player fantasy:** Break the belt meta with horror-portal logistics.
