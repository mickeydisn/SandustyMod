# Sandustry Sandkit — API reference

Low-level API pages extracted against [sandkit.html](https://sandustry.com/sandkit.html).

**Start here for navigation:** [../doc.summary/index.md](../doc.summary/index.md)

```
doc.api/
  main/          # Main entry only
  shared/        # Main + Worker (see method diffs)
  worker/        # Worker entry only
  definitions/   # register() object shapes
```

## Rules

1. Main grid writes are deferred → `api.grid.mutate`
2. Worker grid writes are immediate
3. Register types on Main
4. Structure clicks → `api.signals.interactables.register`
5. Do not pass `state` from mod code

## Also

- [COVERAGE.md](COVERAGE.md)
- [Examples](../doc.exemple/)
