# Item definition

Parent: [../main/api.items.md](../main/api.items.md)

## `register(definition)`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Unique item id |
| `name` | `string` | | Display name fallback |
| `nameKey` | `string` | | i18n key |
| `descriptionKey` | `string` | | i18n description |
| `itemType` | enum/string | | Tool, Weapon, … |
| `sprite` | `{ id: string }` \| string | yes* | Sprite loaded via `api.sprites` |
| `cooldown` | object | | Cooldown state template |
| `energyCost` | `number` | | Energy per use |
| `excavationProfileId` | `string` | | Link to `api.excavation` profile |

\* Required for visible hotbar items.

```js
await api.sprites.loadFromMod("myMod.tool", "assets/tool.png");
api.items.register({
  id: "myMod.tool",
  nameKey: "mods|myMod|items|tool|name",
  sprite: { id: "myMod.tool" },
});
api.player.inventory.addById("myMod.tool");
```

## `updateDefinition(itemId, partial)`
Partial patch of the same fields.
