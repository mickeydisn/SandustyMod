# sandustry-controls

**Asset pack + legacy entry point.** New mods: use `packages/` directly (`buffer`, `catalogue`, `controls`, …).

```ts
// Legacy (ConfigStore + factories + sprites in one import)
import { createControlSystem, loadControlAssets } from "./mods/sandustry-controls/src/index.ts";

// Preferred
import { createControlSystem } from "./packages/controls/src/index.ts";
import { createBufferRecord } from "./packages/buffer/src/index.ts";
import { loadSpriteMap } from "./packages/assets/src/index.ts";
```

See [`examples/`](../../examples/) and [`mods/example/`](../../example/).
