# Example 07 — Operations Dashboard (multi-listener UI)

**APIs:** ui, events, triggers, structures, energy, factory, rendering, input, storage, i18n, settings

**Idea:** Pause-menu style panel + overlay that aggregates events from Ex 01–06: state-pad changes, reactor heat, blasts, alchemy production, battery capacity.

---

## `main.js`

```js
const MOD = "myMod.dashboard";

export async function init(sandkit) {
  const { api } = sandkit;

  api.storage.ensure(MOD);
  const stats = api.storage.get(MOD, "stats") || {
    padFlips: 0, overheats: 0, blasts: 0, dust: 0,
  };

  const save = () => api.storage.set(MOD, "stats", stats);

  api.events.on("myMod.statePad:changed", () => { stats.padFlips++; save(); });
  api.events.on("myMod.reactor:overheat", () => { stats.overheats++; save(); });
  api.events.on("myMod.terraformer:blast", () => { stats.blasts++; save(); });
  api.events.on("myMod.alchemy:produced", () => { stats.dust++; save(); });

  api.input.registerBinding(`${MOD}.open`, ["KeyH"], {
    nameKey: "mods|dashboard|open",
  });

  // Simple approach: toast summary on key; richer: overlays.register panel
  api.triggers.register(`${MOD}:hotkey`, {
    intervalMs: 100,
    data: { wasDown: false },
    callback: (trigger) => {
      // Use binding trigger API if available; else show periodic HUD
    },
  });

  api.ui.overlays.register("hotbar", `${MOD}.strip`, () => {
    const cell = api.input.getMousePositionAtCell();
    const s = api.structures.getAtCell(cell.x, cell.y);
    let line = `Pads ${stats.padFlips} | Heat ${stats.overheats} | Dig ${stats.blasts}`;
    if (s) {
      const cap = api.energy.getNetworkFreeCapacityAtCell?.(s.x, s.y);
      if (cap != null) line += ` | Net ${cap}`;
    }
    // render line via overlay context / tooltip
    api.ui.showTooltip?.(line);
  });

  api.events.on("myMod.reactor:overheat", ({ x, y }) => {
    api.camera.setFocusAtWorld(
      x * api.rendering.getGridMetrics().cellSize,
      y * api.rendering.getGridMetrics().cellSize,
    );
    api.schedule.nextTick(() => api.camera.releaseFocus({ durationMs: 400 }));
  });

  // Factory rates snippet
  api.triggers.register(`${MOD}:factory`, {
    intervalMs: 2000,
    callback: () => {
      const rate = api.factory.getProcessRate?.("shakeWetSand");
      if (rate != null) stats.lastShakeRate = rate;
      save();
    },
  });
}
```

## Interactions

Central **observer** for Ex 01–06. Camera punch on reactor overheat. Persists stats across sessions.
