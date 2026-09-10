/**
 * JsonBuffer example — a versioned JSON record shared across threads.
 *
 * Two instances created with the same key (`gameConfig`) see the SAME shared
 * memory: `gameConfig:ver` (version counter) + `gameConfig:json` (payload).
 * They stay in sync via the version gate — no message passing needed.
 *
 * Run from the repo root with the workspace config:
 *   deno run --config ./deno.json packages/buffer/exemple/jsonBuffer/main.ts
 */

import { JsonBuffer } from "@sandmd/buffer";

const MOD_ID = "buffer-example";
const BUFFER_ID = `${MOD_ID}:gameConfig`;

interface GameConfig {
  volume: number;
  muted: boolean;
  players: { name: string; score: number }[];
}

function main() {
  // First instance seeds the buffer with the default record on first commit.
  const buffer = new JsonBuffer<GameConfig>(
    MOD_ID,
    BUFFER_ID,
    { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
  );
  // Second instance, same key: another view over the same shared memory.
  const buffer2 = new JsonBuffer<GameConfig>(
    MOD_ID,
    BUFFER_ID,
    { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
  );

  buffer.subscribe((s: GameConfig) => console.log("RECORD EVENT", s));
  buffer2.subscribe((s: GameConfig) => console.log("RECORD EVENT 2 : ", s));

  // Mutations are local until commit() publishes + bumps the version.
  buffer.setPath("volume", 0.5);
  console.log("local only (before commit):", buffer.getPath("volume"));
  buffer.commit();

  // Readers pull on read; they re-decode only when the version changed.
  console.log("== buffer2.listPaths()", buffer2.listPaths());
  console.log("== buffer.get()", buffer.get());
  console.log("== buffer2.get()", buffer2.get());
  console.log("== buffer2 remoteVersion:", buffer2.remoteVersion());
}

try {
  void main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
