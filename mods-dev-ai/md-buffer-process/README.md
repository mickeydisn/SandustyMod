# Buffer Process (`md-buffer-process`)

## Shared buffer

**One** JsonBuffer (`md-buffer-process:processConfig`) is shared by:

| Consumer | Role |
|----------|------|
| buffer-controls value / ± actions | read / write `sand_count` |
| Sand Eater | +1 per sand cell eaten |
| Sand Out | −1 per sand cell emitted |

Process structures use a `ProcessMapBuffer` adapter over the same `handles.buffer`.

## Where to place Eater / Out

| Place | Visible? |
|-------|----------|
| Game **build menu** | **No** (`hideFromBuildMenu`) |
| **Buffer Process** picker | **Yes** (category `process`) |

## Config

| Structure  | eatCount | emitCount | counter |
|------------|----------|-----------|---------|
| Sand Eater | 16       | —         | +1 / cell |
| Sand Out   | —        | 16        | −1 / cell |

Shape: **4×4 of 0**. Scan bottom-first.

## Build

```bash
deno task build
```
