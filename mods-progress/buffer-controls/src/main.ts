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
        sprites: [
            // Each entry carries its own asset file — no separate file table.
            { spriteId: "menu", filePath: "assets/types/display.png" },
            { kind: "number", spriteId: "number", filePath: "assets/types/number.png" },
            { kind: "bool", spriteId: "bolean", filePath: "assets/types/bolean.png" },
            { kind: "string", spriteId: "string", filePath: "assets/types/string.png" },

            {
                kind: "number",
                action: "inc",
                spriteId: "actionPlus",
                filePath: "assets/types/plus.png",
            },
            {
                kind: "number",
                action: "dec",
                spriteId: "actionMinus",
                filePath: "assets/types/minus.png",
            },
            {
                kind: "number",
                action: "incX",
                spriteId: "actionPlusX",
                filePath: "assets/types/plusX.png",
            },
            {
                kind: "number",
                action: "decX",
                spriteId: "actionMinusX",
                filePath: "assets/types/minusX.png",
            },
            // Default sign toggle — 3 frames: 0 / >0 / <0.
            {
                kind: "number",
                action: "toggleNum",
                spriteId: "tognum",
                filePath: "assets/types/tognum.png",
            },

            {
                kind: "bool",
                action: "toggle",
                spriteId: "actionToggle",
                filePath: "assets/types/toggle.png",
            },
        ],
        pickerTitle: "Buffer controls",
        // Flat record: paths have no section segment, so no category colors.
        categories: [],
    });
})();

function openDevTools(): void {
    try {
        const electron = (globalThis as { electron?: { openDevTools?: () => void } }).electron;
        electron?.openDevTools?.();
        console.log("GAME STATE", sandkit.state);
    } catch {
        /* devtools bridge unavailable — non-fatal */
    }
}

try {
    openDevTools();
    // const MOD_ID = "";
    findOrphanedObjects(MOD_ID);
    pruneStaleBuildings(MOD_ID);
} catch (e) {
    console.error(e instanceof Error ? e.stack : e);
}
