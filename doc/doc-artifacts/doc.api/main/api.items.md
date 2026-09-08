> **Entry:** Main only.  
> **Object shapes:** [definitions/api.items.definition.md](../definitions/api.items.definition.md)

# `api.items`

Tools/weapons/gadgets in the player inventory/hotbar.

---

## Methods

| Method | Parameters | Returns |
|---|---|---|
| `register(definition)` | `ItemDefinition` | `void` |
| `updateDefinition(itemId, partial)` | | `void` |
| `getRegisteredIds()` | | `string[]` |
| `getDefinitionById(itemId)` | | definition |
| `createById(itemId)` | | instance |
| `getActive()` | | active item \| null |
| `isActiveById(itemId, itemType?)` | | `boolean` |

### Register flow

```js
await api.sprites.load("myMod.toolIcon", "mods/myMod/tool.png");
api.items.register({
  id: "myMod.tool",
  nameKey: "mods|myMod|items|tool|name",
  sprite: { id: "myMod.toolIcon" },
  // itemType, cooldown, etc.
});
api.player.inventory.addById("myMod.tool");
```

**Why sprites first:** Item UI resolves sprite ids at register time.
