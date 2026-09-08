# Example 08 — Tech-Gated Capture Drone

**APIs:** tech, entities, player, triggers, events, ui, i18n, authorization, maps markers

**Idea:** Research unlocks a drone entity. Once researched, binding spawns drone at player, drone auto-walks toward map artifacts and starts capture.

---

## `main.js`

```js
const MOD = "myMod.drone";
const TECH = `${MOD}.research`;
const ENTITY = `${MOD}.bot`;

export async function init(sandkit) {
  const { api } = sandkit;

  api.tech.registerDefinition(TECH, {
    nameKey: "mods|drone|tech|name",
    descriptionKey: "mods|drone|tech|desc",
    cost: 150,
  });
  api.tech.registerNode(TECH, {}, {
    parentId: /* base tech id or prior node */ TECH,
  });
  // Optionally append to vanilla branch:
  // api.tech.conservatory.appendUnlock(sandkit.enums.Tech.SignalDevices, { items: [] });

  api.input.registerBinding(`${MOD}.deploy`, ["KeyJ"], {
    nameKey: "mods|drone|deploy",
  });

  api.events.on(`${MOD}:tryDeploy`, () => {
    if (!api.tech.isResearchedById(TECH)) {
      api.ui.toast({ key: "mods|drone|locked" });
      return;
    }
    const p = api.player.getPositionAtWorld();
    if (!api.player.isPositionClearAtWorld(p.x, p.y)) return;
    const id = api.entities.spawnAtWorld(ENTITY, p.x, p.y);
    api.events.emit(`${MOD}:spawned`, { id });
  });

  api.triggers.register(`${MOD}:ai`, {
    intervalMs: 500,
    callback: () => {
      if (!api.tech.isResearchedById(TECH)) return;
      const arts = api.maps.getArtifactLocations?.() || [];
      const drones = api.entities.getAllByType?.(ENTITY) || [];
      for (const d of drones) {
        // steer toward nearest artifact — launch impulse
        if (!arts.length) continue;
        const target = arts[0];
        const pos = /* entity position field depends on engine */ target;
        api.entities.launch(d.id ?? d, 0, 5);
        api.entities.startCapture?.(d.id ?? d);
      }
    },
  });
}
```

## Interactions

- Tech cost uses same economy as **Ex 02/04**.  
- **Ex 07** can show researched flag.  
- Capture targets relate to **Ex 05** discoveries fantasy.
