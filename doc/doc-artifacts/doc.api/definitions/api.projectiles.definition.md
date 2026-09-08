# Projectile definition

Parent: [../main/api.projectiles.md](../main/api.projectiles.md)

## `register(definition)`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Projectile type id |
| `sprite` | string \| `{ id }` | Visual |
| `getOptions` | `Function` optional | Builds runtime opts |
| `onHit` | `Function` optional | Hit callback |
| speed / lifetime / radius | numbers | Engine-dependent |

## Spawn

```ts
createBlueprintById(projectileId) → blueprint
spawnAtWorld(worldX, worldY, angleRadians, blueprint) → instance
```

| Param | Type | Description |
|---|---|---|
| `worldX`, `worldY` | `number` | Origin world px |
| `angleRadians` | `number` | Direction |
| `blueprint` | object | From `createBlueprintById` |
