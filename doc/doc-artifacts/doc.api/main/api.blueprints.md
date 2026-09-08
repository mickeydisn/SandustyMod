> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.blueprints`

Structure blueprint serialization (Management / copy tools).

## Methods

### `serializeStructures(structures): serialized`
Serializes a list of structure instances for save/clipboard.

| Param | Type | Description |
|---|---|---|
| `structures` | `Structure[]` | Instances to serialize |

### `localizeStructures(structures): void`
Localizes/repairs structure data after load (ids, keys).

| Param | Type | Description |
|---|---|---|
| `structures` | structures | Blueprint payload |
