/**
 * @sandmd/assets — sprite loading examples.
 *
 * These entry points mirror the way a mod `main()` loads art at boot time.
 * They require the in-game `sandkit` runtime (sprites land in the game's
 * sprite cache via `sandkit.api.sprites.loadFromMod`), so — like every other
 * `exemple/main.ts` in this repo — they are documentation-in-code and are not
 * meant to be executed standalone outside the game.
 *
 * Type-check them against the public API with:
 *   deno check packages/assets/exemple/main.ts
 */

import { loadFromFileMap, loadSizedAsset, loadSpriteMap } from "@sandmd/assets";
import type { CatalogueSpriteEntry } from "@sandmd/assets";

const MOD_ID = "assets-example";

/** 1. Load a list of sprites concurrently with a bounded worker pool. */
export async function exempleLoadSpriteMap(): Promise<Record<string, string>> {
  const entries: CatalogueSpriteEntry[] = [
    { id: "vase", file: "deco/vase.png" },
    { id: "lamp", file: "deco/lamp.png" },
    { id: "rug", file: "deco/rug.png" },
  ];

  const map = await loadSpriteMap(MOD_ID, entries, {
    assetDir: "assets",
    concurrency: 2, // how many sprites load at once (default 16)
  });

  for (const [id, spriteId] of Object.entries(map)) {
    console.log(`${id} => ${spriteId}`); // vase => assets-example:vase
  }
  return map;
}

/** 2. Shorthand: a { logicalId: relativePath } map instead of an entry list. */
export async function exempleLoadFromFileMap(): Promise<Record<string, string>> {
  const map = await loadFromFileMap(MOD_ID, {
    "power-core": "machines/power-core.png",
    "conveyor": "machines/conveyor.png",
  });
  return map;
}

/** 3. Load one sprite under an explicit mod-relative path. */
export async function exempleLoadSizedAsset(): Promise<string> {
  const spriteId = await loadSizedAsset(
    MOD_ID,
    "big-windmill",
    "structures/windmill.png",
    "assets",
  );
  // spriteId === "assets-example:big-windmill"
  return spriteId;
}

/** 4. Prefix sprite ids to keep several asset groups from colliding. */
export async function exempleWithIdPrefix(): Promise<Record<string, string>> {
  return loadSpriteMap(
    MOD_ID,
    [{ id: "frame", file: "furniture/frame.png" }],
    { idPrefix: "deco/", assetDir: "assets" },
  ); // -> { frame: "assets-example:deco/frame" }
}

function main() {
  void exempleLoadSpriteMap();
  void exempleLoadFromFileMap();
  void exempleLoadSizedAsset();
  void exempleWithIdPrefix();
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
