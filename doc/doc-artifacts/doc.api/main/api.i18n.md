> **Entry:** Main only.

# `api.i18n`

## Methods

### `register(locale, translations): void`

| Param | Type | Description |
|---|---|---|
| `locale` | `string` | e.g. `"en"` |
| `translations` | `Record<string, string>` | key → text |

### `t(key, params?): string`

| Param | Type | Description |
|---|---|---|
| `key` | `string` | e.g. `"mods|myMod|title"` |
| `params` | `object` optional | `{ count: 3 }` interpolation |

### `getLocale(): string` / `setLocale(locale): void`
### `hasTranslation(key, locale?): boolean`
### `getLanguages()` / `getAvailableLocales()`
### `formatNumber(value, options?): string`

```js
api.i18n.register("en", {
  "mods|myMod|title": "My Mod",
  "mods|myMod|count": "Count: {count}",
});
api.i18n.t("mods|myMod|count", { count: 3 });
```
