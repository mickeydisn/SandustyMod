# Example 01 — Signal State Pad (5 frames + interactables + events)

**APIs:** structures, sprites, signals.interactables, signals.targets, events, effects, lights, player.buildings, i18n, config

**Idea:** A pad with 5 visual states. Player interact cycles state; external signals can force a state; other mods listen on the event bus.

---

## Files

```
myMod.statePad/
├── modinfo.json
├── main.js
└── assets/statepad.png    # 5 frames horizontal
```

## `modinfo.json`

```json
{
  "manifestVersion": 1,
  "id": "myMod.statePad",
  "name": "State Pad",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "main.js"
}
```

## `main.js`

```js
const MOD = "myMod.statePad";
const SID = `${MOD}.pad`;
const SPRITE = `${MOD}.sheet`;
const STATES = 5;

export async function init(sandkit) {
  const { api } = sandkit;

  api.i18n.register("en", {
    "mods|statePad|name": "State Pad",
    "mods|statePad|desc": "Click to cycle 5 states. Accepts signals.",
    "mods|statePad|toast": "State → {state}",
  });

  await api.sprites.loadFromMod(SPRITE, "assets/statepad.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|statePad|name",
    descriptionKey: "mods|statePad|desc",
    categoryKey: "logic",
    buildModes: [{ type: "single" }],
    shape: [[1]],
    defaultData: { state: 0, locked: false },
    render: { imageName: SPRITE, size: { width: 16, height: 16 } },
    spritesheet: { frameSize: { width: 16, height: 16 } },
  });

  api.player.buildings.unlockById(SID);

  api.signals.interactables.register(SID, (structure) => {
    if (structure.data?.locked) return;
    applyState(api, structure, (structure.data.state + 1) % STATES, "interact");
  });

  api.signals.targets.register(SID, (structure, payload) => {
    // powered → jump to state 4; unpowered → 0
    applyState(api, structure, payload.combined ? 4 : 0, "signal");
  });

  api.events.on(`${MOD}:changed`, (e) => {
    api.ui.toast({
      key: "mods|statePad|toast",
      // if toast supports params in your build, pass state
    });
  });
}

function applyState(api, structure, next, source) {
  const prev = structure.data?.state ?? 0;
  if (prev === next && source === "signal") return;

  api.structures.updateData(structure, { ...structure.data, state: next }, {
    propagateToWorkers: true,
  });
  api.structures.setSpritesheetIndexByValueAtCell(
    structure.x, structure.y, next, [0, 1, 2, 3, 4],
  );

  const { cellSize } = api.config.getLegacy?.() || api.rendering.getGridMetrics();
  const wx = structure.x * cellSize + cellSize / 2;
  const wy = structure.y * cellSize + cellSize / 2;
  api.lights.temporary.createAtWorld(wx, wy, {
    durationMs: 150, brightness: 1.2, size: 48, color: [0.4, 0.8, 1, 1],
  });

  api.events.emit(`${MOD}:changed`, {
    x: structure.x, y: structure.y, state: next, prev, source,
  });
}
```

## Interactions with other examples

- **Ex 03 Reactor** can `events.emit` or signal-link to force state 4 when overheating.  
- **Ex 07 Dashboard** listens `${MOD}:changed` to show counters.
