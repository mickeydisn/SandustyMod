/**
 * md-buffer-process
 *
 * Catalogue buildings (production):
 *   Sand Eater — 1 cell sand inside 4×4 footprint → sand_count +1
 *   Sand Out   — sand_count > 0 → −1 and replace 1 cell with sand
 *
 * Menu (buffer-controls): display / ± only — NOT the eater/out buildings.
 */
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";
import { loadSpriteMap } from "@sandmd/assets";
import { JsonMapBuffer } from "@sandmd/buffer";
import { type BufferControlsField, registerBufferControls } from "@sandmd/buffer-controls";
import {
    type ProcessDefinition,
    registerProcessStructures,
} from "./packages/buffer-process/index.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";

let started = false;

interface ProcessConfig {
    sand_count: number;
}

const MAP_KEY = `${MOD_ID}:processConfig`;
const SAND_COUNT_MAX = 10_000;

const BUFFER_FIELDS: BufferControlsField[] = [
    {
        path: "sand_count",
        kind: "number",
        default: 0,
        tag: "sand_count",
        category: "process",
    },
];

/** Catalogue building — production */
const SAND_EATER: ProcessDefinition = {
    id: `${MOD_ID}:sand-eater`,
    name: "Sand Eater",
    description:
        "4×4 production building. Each tick: remove 1 sand cell inside the footprint and add +1 to sand_count.",
    categoryKey: "production",
    order: 10,
    alwaysUnlocked: true,
    actif: { path: "sand_count", op: "always" },
    intervalMs: 100,
    elm: "sand",
    eatCount: 16,
    eatMax: SAND_COUNT_MAX,
    action: { path: "sand_count", op: "inc" },
    residu: null,
    emitCount: 1,
};

/** Catalogue building — production */
const SAND_OUT: ProcessDefinition = {
    id: `${MOD_ID}:sand-out`,
    name: "Sand Out",
    description:
        "4×4 production building. While sand_count > 0: −1 and replace 1 cell inside the footprint with sand.",
    categoryKey: "production",
    order: 20,
    alwaysUnlocked: true,
    actif: { path: "sand_count", op: "gt0" },
    intervalMs: 100,
    elm: null,
    eatCount: 16,
    eatMax: null,
    action: { path: "sand_count", op: "dec" },
    residu: "sand",
    emitCount: 1,
};

async function main(): Promise<void> {
    if (started) return;
    started = true;

    console.log(`${LOG} v${VERSION} starting…`);

    try {
        const processSprites = await loadSpriteMap(MOD_ID, [
            { id: "sand-eater", filePath: "assets/types/sand-eater.png" },
            { id: "sand-out", filePath: "assets/types/sand-out.png" },
        ]);
        SAND_EATER.spriteId = processSprites["sand-eater"];
        SAND_OUT.spriteId = processSprites["sand-out"];
    } catch (err) {
        console.warn(`${LOG} process sprites failed (structures still register)`, err);
    }

    let map: JsonMapBuffer<ProcessConfig>;
    try {
        map = new JsonMapBuffer<ProcessConfig>({
            key: MAP_KEY,
            defaultRecord: { sand_count: 0 },
            maxBytes: 16 * 1024,
            counters: {
                sand_count: { min: 0, max: SAND_COUNT_MAX },
            },
            persist: true,
            loadFromStorage: true,
        });
        console.log(`${LOG} JsonMapBuffer ready key=${MAP_KEY}`);
    } catch (err) {
        console.error(`${LOG} JsonMapBuffer failed — abort`, err);
        started = false;
        return;
    }

    // Catalogue FIRST — independent of buffer-controls menu
    try {
        const processHandles = registerProcessStructures(map, [
            SAND_EATER,
            SAND_OUT,
        ]);
        console.log(
            `${LOG} catalogue buildings: ${processHandles.structureIds.join(", ")}`,
        );
    } catch (err) {
        console.error(`${LOG} process structures failed`, err);
    }

    // Optional menu for counter display / ± (not the eater/out buildings)
    try {
        await registerBufferControls<ProcessConfig>({
            modId: MOD_ID,
            bufferId: `${MOD_ID}:processConfigUi`,
            fields: BUFFER_FIELDS,
            maxBytes: 16 * 1024,
            storage: { persist: true, load: true },
            pathScan: { maxDepth: 4, includeContainers: false },
            menuItemId: `${MOD_ID}:menu`,
            initialItemId: "sand_count",
            menu: {
                label: "Buffer Process",
                description: "sand_count display and ± buttons.",
                spriteId: "menu",
            },
            kindSprites: [
                { spriteId: "menu", filePath: "assets/types/display.png" },
                { kind: "number", spriteId: "number", filePath: "assets/types/number.png" },
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
            ],
            categories: [{ id: "process", color: "#E8B86D" }],
            unmappedCategoryColor: "#FFFFFF",
            picker: {
                id: `${MOD_ID}:picker`,
                slot: "hotbar",
                title: "Buffer process",
                persistSelection: true,
            },
        });
        console.log(`${LOG} buffer-controls menu ready (display only)`);
    } catch (err) {
        console.warn(`${LOG} buffer-controls failed (catalogue still ok)`, err);
    }

    safe(() => sandkit.api.ui.toast(`${MOD_ID} v${VERSION}`, {}));
    console.log(`${LOG} v${VERSION} enabled`);
}

function teardown(): void {
    if (!started) return;
    started = false;
}

function applyEnabled(enabled: boolean, reason: string): void {
    if (enabled) {
        void main();
        return;
    }
    teardown();
    runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
    console.log(`${LOG} v${VERSION} disabled (${reason})`);
}

try {
    applyEnabled(readSettings(MOD_ID, SETTINGS).enabled, "boot-disabled");
    onSettingsChange(MOD_ID, SETTINGS, (cfg) => applyEnabled(cfg.enabled, "config-change"));
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runDisableCleanup(MOD_ID, "init-error", STORAGE_KEYS);
}
