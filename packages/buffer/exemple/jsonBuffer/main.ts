/**
 * Sandustry Icons — decorative catalogue (deco-style picker, no cost).
 */

import { JsonBuffer } from "@sandmd/buffer";

const MOD_ID = "buffer-controls";
const BUFFER_ID = `${MOD_ID}:gameConfig`;

interface GameConfig {
  volume: number;
  muted: boolean;
  players: { name: string; score: number }[];
}

function main() {
  const buffer = new JsonBuffer<GameConfig>(
    MOD_ID,
    BUFFER_ID,
    { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
  );
  const buffer2 = new JsonBuffer<GameConfig>(
    MOD_ID,
    BUFFER_ID,
    { volume: 1, muted: false, players: [{ name: "Bob", score: 0 }] } as GameConfig,
  );

  // buffer.setPath("volume", 2);

  buffer.subscribe((s: GameConfig) => console.log("RECORD EVENT", s));
  buffer2.subscribe((s: GameConfig) => console.log("RECORD EVENT 2 : ", s));

  buffer.commit();

  console.log("== record2.listPaths()", buffer2.listPaths());
  console.log("== record.get()", buffer.get());
  console.log("== record2.get()", buffer2.get());
}

try {
  void main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
