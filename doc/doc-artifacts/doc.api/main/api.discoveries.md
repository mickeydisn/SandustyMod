> **Entry:** Main only.

# `api.discoveries`

Codex / discovery unlocks.

## Methods

### `addElementByType(elementType): void`

| Param | Type | Description |
|---|---|---|
| `elementType` | number \| type | Element type token |

### `addTerrainByType(terrainType): void`

| Param | Type | Description |
|---|---|---|
| `terrainType` | number \| type | Terrain type token |

Marks the type discovered for UI/progression. Safe to call if already discovered (engine dedupes).
