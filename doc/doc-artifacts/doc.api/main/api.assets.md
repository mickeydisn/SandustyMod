> **Entry:** Main only. Official: [sandkit.html](https://sandustry.com/sandkit.html).

# `api.assets`

Asset URL and provider selection (`manifest.provides`).

## Methods

### `getUrl(relativePath): string`
Resolves a mod-relative path to a loadable URL.

| Param | Type | Description |
|---|---|---|
| `relativePath` | `string` | Path inside mod |

### `getSelectedProvider(kind): providerId | null`

| Param | Type | Description |
|---|---|---|
| `kind` | `string` | Provide kind (e.g. structure texture pack) |

### `setSelectedProvider(kind, providerId): void`
Alias: `selectProvider`.

| Param | Type | Description |
|---|---|---|
| `kind` | `string` | Provider kind |
| `providerId` | `string` | Provider from `api.mods.getProviders` |

**Related:** texture **loading** uses `api.sprites.load`.
