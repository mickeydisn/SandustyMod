> **Entry:** Main only.

# `api.mods`

Discover contributions from other mods’ manifests.

## Methods

### `getProviders(kind): Provider[]`

| Param | Type | Description |
|---|---|---|
| `kind` | `string` | Matches `manifest.provides[].kind` |

**Returns:** array of provider descriptors (ids usable with `api.assets.setSelectedProvider`).

**Example kinds:** `"structureTextures"`, other `provides.kind` values from mods.

```js
const providers = api.mods.getProviders("structureTextures");
if (providers[0]) {
  api.assets.setSelectedProvider("structureTextures", providers[0].id);
}
```
