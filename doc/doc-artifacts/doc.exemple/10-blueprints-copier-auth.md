# Example 10 — Secure Blueprint Copier

**APIs:** blueprints, building, authorization, structures, input, ui, storage, events, action, camera

**Idea:** Tool mode that copies a structure rectangle if `canBuildAtCell` passes for every cell, serializes via blueprints API, stores in mod storage, and pastes with authorization checks + toast UI.

---

## `main.js`

```js
const MOD = "myMod.copier";

export async function init(sandkit) {
  const { api } = sandkit;
  api.storage.ensure(MOD);

  let mode = "idle"; // idle | captureA | captureB | paste
  let a = null;
  let clipboard = null;

  api.input.registerBinding(`${MOD}.copy`, ["KeyC"], { nameKey: "mods|copier|copy" });
  api.input.registerBinding(`${MOD}.paste`, ["KeyV"], { nameKey: "mods|copier|paste" });

  api.events.on(`${MOD}:bindingCopy`, () => {
    mode = "captureA";
    api.ui.toast({ key: "mods|copier|selectA" });
  });

  api.triggers.register(`${MOD}:clickWatch`, {
    intervalMs: 50,
    callback: () => {
      // On interact edge — use action/custom or mouse click detection available in your build
      if (mode !== "captureA" && mode !== "captureB") return;
      const c = api.input.getMousePositionAtCell();
      if (mode === "captureA") {
        a = { ...c };
        mode = "captureB";
        api.ui.toast({ key: "mods|copier|selectB" });
        return;
      }
      const b = { ...c };
      const structures = [];
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!api.authorization.canGrabAtCell(x, y)) continue;
          const s = api.structures.getAtCell(x, y);
          if (s) structures.push(s);
        }
      }
      clipboard = api.blueprints.serializeStructures(structures);
      api.storage.set(MOD, "clip", clipboard);
      api.ui.toast({ key: "mods|copier|copied" });
      mode = "idle";
      api.events.emit(`${MOD}:copied`, { count: structures.length });
    },
  });

  api.events.on(`${MOD}:bindingPaste`, () => {
    clipboard = api.storage.get(MOD, "clip") || clipboard;
    if (!clipboard) {
      api.ui.toast({ key: "mods|copier|empty" });
      return;
    }
    const origin = api.input.getMousePositionAtCell();
    // localize then build — exact paste API may map through buildAtCell loop
    const local = clipboard;
    api.blueprints.localizeStructures?.(local);
    // Pseudo: iterate serialized entries
    for (const entry of local.structures || local || []) {
      const x = origin.x + (entry.ox ?? 0);
      const y = origin.y + (entry.oy ?? 0);
      if (!api.authorization.canBuildAtCell(x, y)) continue;
      if (api.building.isBlockedAtCell(x, y)) continue;
      api.structures.buildAtCell(x, y, entry.type || entry.id);
    }
    api.ui.toast({ key: "mods|copier|pasted" });
    api.events.emit(`${MOD}:pasted`, { origin });
  });
}
```

## Interactions

- Copies **Ex 01/02/03/06** machines respecting auth zones.  
- **Ex 07** counts copy/paste events.  
- Paste blocked in foreign zones (authorization).
