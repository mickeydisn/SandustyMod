# Example 06 — Smart Filter Conveyor

**APIs:** structures, structureBehaviors, processing, elements, placementConfig, signals, i18n, sprites

**Idea:** Conveyor variant with placement UI (channel + mode). Processing inspects the cell above and only allows configured element types; mode toggled by signal.

---

## `main.js`

```js
const MOD = "myMod.filterBelt";
const SID = `${MOD}.belt`;

export async function init(sandkit) {
  const { api } = sandkit;

  await api.sprites.loadFromMod(`${MOD}.img`, "assets/belt.png");

  api.structures.register({
    id: SID,
    nameKey: "mods|filterBelt|name",
    categoryKey: "logistics",
    buildModes: [{ type: "line", directions: ["horizontal"] }],
    shape: [[1]],
    defaultData: { mode: "allow", channel: 1, filterType: "sand" },
    render: { imageName: `${MOD}.img`, size: { width: 16, height: 16 } },
    tooltipHover: {
      type: "custom",
      dataFieldMessage: {
        messageKey: "mods|filterBelt|tip",
        fields: [
          { param: "mode", field: "mode", valueKeys: {
            allow: "mods|filterBelt|allow",
            block: "mods|filterBelt|block",
          }},
          { param: "channel", field: "channel", fallback: 1, round: true },
        ],
      },
    },
  });

  api.structures.registerPlacementConfig({
    structureId: SID,
    fields: [
      {
        type: "choice",
        id: "mode",
        labelKey: "mods|filterBelt|mode",
        default: "allow",
        options: [
          { value: "allow", label: "Allow" },
          { value: "block", label: "Block" },
        ],
      },
      {
        type: "integer",
        id: "channel",
        label: "Channel",
        default: 1, min: 1, max: 8,
      },
    ],
  });

  api.structureBehaviors.registerConveyorType(SID, { runWith: "right" });
  api.player.buildings.unlockById(SID);

  api.structures.processing.register(`${SID}:gate`, {
    structureType: SID,
    intervalMs: 100,
    process: (structure, context) => {
      const x = structure.x;
      const y = structure.y - 1;
      if (context.isCellEmptyAtCell(x, y)) return;
      const allow = structure.data.mode !== "block";
      const want = structure.data.filterType || "sand";
      const isWanted = api.elements.isTypeAtCell(x, y, want);
      if (allow && !isWanted) {
        // soft-block: zero velocity / mark blocked if API available
        api.elements.setVelocityAtCell?.(x, y, { x: 0, y: 0 });
      }
    },
  });

  api.signals.targets.register(SID, (structure, payload) => {
    api.structures.updateData(structure, {
      ...structure.data,
      mode: payload.combined ? "allow" : "block",
    }, { propagateToWorkers: true });
  });
}
```

## Interactions

- Moves **Ex 05** dust and vanilla sand.  
- Channel field shared conceptually with **Ex 01** signal logic.  
- **Ex 07** can forEachOfType and list filter modes.
