> **Entry:** Main only.  
> **Object shapes:** [definitions/api.tech.definition.md](../definitions/api.tech.definition.md)

# `api.tech`

Research tree definitions and unlocks.

| Method | Parameters | Returns |
|---|---|---|
| `registerDefinition(techId, definition)` | see definitions | `void` |
| `updateDefinition(techId, partial)` | | `void` |
| `getDefinitionById(techId)` | | definition |
| `registerNode(techId, definition, options)` | `options.parentId`, `preferredPosition?` | position |
| `conservatory.appendUnlock(techId, unlocks)` | `{ structures?, items? }` | `void` |
| `isResearchedById(techId)` | | `boolean` |
| `isLockedById(techId)` | | `boolean` |
| `setLockedById(techId, locked)` | | `void` |

```js
api.tech.registerDefinition("myMod.tech1", {
  nameKey: "mods|myMod|tech1|name",
  descriptionKey: "mods|myMod|tech1|desc",
  cost: 100,
});
api.tech.registerNode("myMod.tech1", def, { parentId: parentTechId });
api.tech.conservatory.appendUnlock(sandkit.enums.Tech.SignalDevices, {
  structures: ["myMod.sensor"],
});
```

**Why conservatory.appendUnlock:** Attach unlocks to an existing vanilla tech node without rewiring the whole tree.
