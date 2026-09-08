> **Entry:** Main only.  
> **Object shapes:** [definitions/api.upgrades.definition.md](../definitions/api.upgrades.definition.md)

# `api.upgrades`

Item upgrade levels (tools, guns, …).

## Methods

### `registerCategory(definition): void`
Registers an upgrade category for UI grouping.

| Param | Type | Description |
|---|---|---|
| `definition.id` | `string` | Category id |
| `definition.nameKey` | `string` optional | i18n |
| `definition.order` | `number` optional | Sort |

### `register(definition): void`
Registers an upgrade on an item.

### `updateDefinition(itemId, upgradeId, partial): void`
Patches upgrade definition.

### `getLevelById(itemId, upgradeId): number`
Current purchased level.

### `getAvailableLevelById(itemId, upgradeId): number`
Max available / unlocked level gate.

### `setLevelById(itemId, upgradeId, level): void`
Sets level (cheats, migration, rewards).

| Param | Type | Description |
|---|---|---|
| `itemId` | `string` | Item id |
| `upgradeId` | `string` | Upgrade id |
| `level` | `number` | Level index |
