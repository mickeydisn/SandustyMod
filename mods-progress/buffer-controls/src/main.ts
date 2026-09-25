/**
 * Buffer Controls — mod entry point.
 *
 * All generic wiring (catalogue, structure registers, value refresh, picker)
 * lives in the @sandmd/buffer-controls package. This file is configuration
 * only: which record to expose, which sprites to use, and the labels shown
 * in the picker tabs / build menu — then a single registerBufferControls().
 */
import "@sandmd/sandkit";
import { findOrphanedObjects, pruneStaleBuildings } from "@sandmd/modkit";
import { type BufferControlsField, registerBufferControls } from "@sandmd/buffer-controls";
import { CONFIG_FIELDS, type ConfigFieldRecord } from "./configSchema.ts";

const MOD_ID = "buffer-controls";

/**
 * One declared field per schema entry — the JsonBuffer record, the sprite list
 * and every catalogue item's tag / category are derived from this list.
 */
const FIELDS: BufferControlsField[] = CONFIG_FIELDS.map((field) => ({
    path: field.key,
    kind: field.kind,
    default: field.default,
    tag: field.key,
    category: "settings",
}));

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

void (async () => {
    await registerBufferControls<ConfigFieldRecord>({
        modId: MOD_ID,
        bufferId: `${MOD_ID}:gameConfig`,
        fields: FIELDS,
        maxBytes: 64 * 1024,
        storage: { persist: true, load: true },
        pathScan: { maxDepth: 8, includeContainers: true },
        menuItemId: `${MOD_ID}:menu`,
        initialItemId: FIELDS[0].path,
        menu: {
            label: "Buffer Controls",
            description: "Buffer Controls — opens the variable picker.",
            spriteId: "menu",
        },
        // Generic art: each entry carries its own asset file — no file table.
        kindSprites: [
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
            // No generic `toggleNum` / `toggleRate` entries here: a number only
            // gets a toggle button where its field declares one.

            {
                kind: "bool",
                action: "toggle",
                spriteId: "actionToggle",
                filePath: "assets/types/toggle.png",
            },
        ],
        // Flat record: every path belongs to the explicit settings category.
        categories: [],
        unmappedCategoryColor: "#FFFFFF",
        picker: {
            id: `${MOD_ID}:picker`,
            slot: "hotbar",
            title: "Buffer controls",
            persistSelection: true,
        },
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
