# Example 24 — Last Will of the Demolisher (funeral rites)

**Pitch:** Hook structure removal. When the player demolishes, spawn a temporary memorial light, a seed, and write an epitaph line into `storage` log. Optionally soft-block demolish of “blessed” structures unless signal unlocked.

**Why it’s not trivial:** `hooks.intercept` on building removal / action, emotional UX, storage chronicle, discoveries joke, interacts with authorization.

**APIs:** hooks, events, elements, lights, storage, ui, sound, structures

```js
const MOD = "weird.lastWill";

export async function init({ api }) {
  api.storage.ensure(MOD);
  const book = api.storage.get(MOD, "epitaphs") || [];

  api.hooks.intercept("prepareBuildingRemoval", (ctx) => {
    // name may vary — also listen events onBuildingPlaced inverse
  });

  api.events.on("onBuildingPlaced", () => {}); // noop

  // Practical approach: listen demolish via action + trigger sampling
  api.events.on?.("structure:removed", (e) => {
    const { x, y, type } = e;
    const line = {
      t: api.time.getElapsedMs(),
      type,
      x, y,
      text: `Here stood ${type} at ${x},${y}`,
    };
    book.push(line);
    if (book.length > 50) book.shift();
    api.storage.set(MOD, "epitaphs", book);

    api.lights.persistent?.createAtWorld?.(x * 4, y * 4, {
      brightness: 0.8, size: 35,
    });
    api.schedule.nextTick(() => {
      api.lights.persistent?.fadeAtWorld?.(x * 4, y * 4, 5000);
    });
    if (api.grid.isCellEmptyAtCell(x, y)) {
      api.elements.createAtCell(x, y, "seed", {});
    }
    api.sound.play("ui.softBell");
    api.ui.toast({ key: "mods|lastWill|farewell" });
    api.events.emit("weird.lastWill:memorial", line);
  });

  // Fallback: wrap demolisher use by tracking structure count snapshots in a trigger
  let snapshot = new Set();
  api.triggers.register(`${MOD}:watch`, {
    intervalMs: 300,
    callback: () => {
      const live = new Set();
      // cannot easily iterate all structures — track types of interest
      for (const id of ["hood.sieveTower.tower", "weird.echoTomb.tomb"]) {
        api.structures.forEachOfType(id, (s) => live.add(`${s.x}:${s.y}:${id}`));
      }
      for (const key of snapshot) {
        if (!live.has(key)) {
          const [x, y, type] = key.split(":");
          api.events.emit("structure:removed", { x: +x, y: +y, type });
        }
      }
      snapshot = live;
    },
  });
}
```

**Player fantasy:** The factory mourns; your demolish log becomes lore.
