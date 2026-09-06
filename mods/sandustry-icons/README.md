# Sandustry Icons

Decorative placement mod — **deco-style picker without cost**.

Uses **sandustry-kit** packages:

- `@sandustry/catalogue` — build list, picker overlay, floor/wall alignment
- `@sandustry/assets` — concurrent sprite loading

## Setup

1. Ensure PNG assets are in `assets/` (see `assets/MANIFEST.md`).
2. Regenerate catalogue after adding sprites:

```bash
node tools/generate-catalogue.mjs
```

3. Install as a Sandustry mod (copy folder or symlink into your mods directory).

## Behaviour

- One build-menu entry: **Icons**
- Picker overlay: categories, search, mirror toggle
- Structures use `copyData: true` for paste-friendly metadata
- No wallet, vouchers, or placement intercept

## License

MIT
