/**
 * Buffer Controls — mod entry point.
 *
 * All generic wiring (catalogue, structure registers, value refresh, picker)
 * lives in the @sandmd/buffer-controls package. This file is configuration
 * only: which record to expose, which sprites to use, and the labels shown
 * in the picker tabs / build menu — then a single registerBufferControls().
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/dev";
import { registerBufferControls } from "@sandmd/buffer-controls";
import { buildDefaultConfigRecord, ConfigFieldRecord } from "./configSchema.ts";

const MOD_ID = "buffer-controls";

/** The record exposed to the player (every scalar path becomes a structure). * /
interface GameConfig {
    volume: number;
    muted: boolean;
    label: string;
    players: { name: string; score: number }[];
}

const defaultValue = {
    volume: 1,
    muted: false,
    label: "hello",
    players: [{ name: "Bob", score: 0 }],
};
*/

const defaultValue: ConfigFieldRecord = buildDefaultConfigRecord();

void (async () => {
    await registerBufferControls<ConfigFieldRecord>({
        modId: MOD_ID,
        bufferId: `${MOD_ID}:gameConfig`,
        defaultRecord: defaultValue,
        menu: {
            label: "Buffer Controls",
            description: "Buffer Controls — opens the variable picker.",
            spriteId: "menu",
        },
        categories: { variables: "Variables", value: "Value", action: "Action" },
        sprites: {
            kind: { bool: "bolean", number: "number", string: "string" },
            action: { inc: "actionPlus", dec: "actionMinus", toggle: "actionToggle" },
        },
        spriteFiles: [
            { id: "number", filePath: "assets/types/number.png" },
            { id: "bolean", filePath: "assets/types/bolean.png" },
            { id: "string", filePath: "assets/types/string.png" },
            { id: "menu", filePath: "assets/types/display.png" },
            { id: "actionPlus", filePath: "assets/types/plus.png" },
            { id: "actionMinus", filePath: "assets/types/minus.png" },
            { id: "actionToggle", filePath: "assets/types/toggle.png" },
        ],
        pickerTitle: "Buffer controls",
    });
})();

try {
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
}
