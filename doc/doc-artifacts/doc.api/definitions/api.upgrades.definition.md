# Upgrade definition

Parent: [../main/api.upgrades.md](../main/api.upgrades.md)

## Category

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Category id |
| `nameKey` | `string` | i18n |
| `order` | `number` | UI sort |

## Upgrade register

| Field | Type | Description |
|---|---|---|
| `itemId` | `string` | Parent item |
| `upgradeId` / `id` | `string` | Upgrade id |
| `maxLevel` | `number` | Cap |
| `costs` | `number[]` | Cost per level (gold) |
| `nameKey` | `string` | i18n |

Effects (power multipliers, capacity, …) are applied by item code reading `getLevelById`.
