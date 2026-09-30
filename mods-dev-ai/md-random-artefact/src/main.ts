/**
 * md-random-artefact v0.2
 *
 * - 1× Artefact Generator (creator): multi-material eat cycles, signal auto-spawn
 * - Hidden Artefact: produces elements, max 5 live (buffer nbArtefactPlace)
 * - Material links (Gold / Copper / Sand): activate + signal when that material is picked
 * - Display: nearby remaining progress
 * - All structures in category "Artefact"
 */
import "@sandmd/sandkit";
import { onSettingsChange, readSettings, runDisableCleanup, safe } from "@sandmd/modkit";
import { loadSpriteMap } from "@sandmd/assets";
import { JsonMapBuffer } from "@sandmd/buffer";
import {
    EAT_MATERIALS,
    LOG,
    MAP_KEY,
    MAX_PROGRESS,
    MOD_ID,
    SETTINGS,
    STORAGE_KEYS,
    VERSION,
    type ArtefactProgress,
} from "./constants.ts";
import { registerGenerator } from "./structures/generator.ts";
import { registerArtefact } from "./structures/artefact.ts";
import { registerMaterialStructures } from "./structures/materials.ts";
import { registerTerrainCollector } from "./structures/terrainCollector.ts";
import { registerSpawnZoneOverlay, unregisterSpawnZoneOverlay } from "./overlay/spawnZone.ts";
import { syncBufferFromWorld } from "./utils/cleanup.ts";

let started = false;

async function main(): Promise<void> {
    if (started) return;
    started = true;
    console.log(`${LOG} v${VERSION} starting…`);

    // Spritesheets: frames are 16×16 in a horizontal row
    // generator.png = 48×16 (idle | active | signal)
    // material-*.png = 32×16 (idle | active)
    const spriteEntries: { id: string; filePath: string }[] = [
        { id: "generator", filePath: "assets/types/generator.png" },
        { id: "artefact", filePath: "assets/types/artefact.png" },
        { id: "terrain-collector", filePath: "assets/types/terrain-collector.png" },
    ];
    for (const m of EAT_MATERIALS) {
        spriteEntries.push(
            { id: `material-${m.id}`, filePath: `assets/types/material-${m.id}.png` },
        );
    }

    let sprites: Record<string, string> = {};
    try {
        sprites = await loadSpriteMap(MOD_ID, spriteEntries);
    } catch (err) {
        console.warn(`${LOG} sprites failed (structures still register)`, err);
        for (const e of spriteEntries) {
            sprites[e.id] = `${MOD_ID}:${e.id}`;
        }
    }

    let map: JsonMapBuffer<ArtefactProgress>;
    try {
        map = new JsonMapBuffer<ArtefactProgress>({
            key: MAP_KEY,
            defaultRecord: {
                progress: 0,
                active: 0,
                nbCreatorPlace: 0,
                nbArtefactPlace: 0,
                materialIndex: 0,
                terrainProgress: 0,
                terrainActive: 0,
                nbTerrainCollectorPlace: 0,
                terrainMaterialIndex: 0,
            },
            maxBytes: 8 * 1024,
            counters: {
                progress: { min: 0, max: MAX_PROGRESS },
                active: { min: 0, max: 1 },
                nbCreatorPlace: { min: 0, max: 1 },
                nbArtefactPlace: { min: 0, max: 64 },
                materialIndex: { min: 0, max: Math.max(0, EAT_MATERIALS.length - 1) },
                terrainProgress: { min: 0, max: 10_000 },
                terrainActive: { min: 0, max: 1 },
                nbTerrainCollectorPlace: { min: 0, max: 1 },
                terrainMaterialIndex: { min: 0, max: 16 },
            },
            persist: true,
            loadFromStorage: true,
        });
        // Counts from storage are NOT trusted — overwritten after world scan below
        console.log(`${LOG} JsonMapBuffer ready key=${MAP_KEY} (counts will sync from world scan)`);
    } catch (err) {
        console.error(`${LOG} JsonMapBuffer failed — abort`, err);
        started = false;
        return;
    }

    try {
        registerGenerator(map, {
            sheet: sprites["generator"] ?? `${MOD_ID}:generator`,
        });
    } catch (err) {
        console.error(`${LOG} registerGenerator failed`, err);
    }

    try {
        registerArtefact(sprites["artefact"] ?? `${MOD_ID}:artefact`, map);
    } catch (err) {
        console.error(`${LOG} registerArtefact failed`, err);
    }

    try {
        registerTerrainCollector(
            map,
            sprites["terrain-collector"] ?? `${MOD_ID}:terrain-collector`,
        );
    } catch (err) {
        console.error(`${LOG} registerTerrainCollector failed`, err);
    }

    try {
        const matSprites: Record<string, string> = {};
        for (const m of EAT_MATERIALS) {
            matSprites[m.id] = sprites[`material-${m.id}`] ?? `${MOD_ID}:material-${m.id}`;
        }
        registerMaterialStructures(map, matSprites);
    } catch (err) {
        console.error(`${LOG} registerMaterialStructures failed`, err);
    }

    try {
        registerSpawnZoneOverlay();
    } catch (err) {
        console.warn(`${LOG} overlay failed`, err);
    }

    // Ignore stored counts: scan live structures and write real numbers into the buffer
    const runWorldSync = (reason: string) => {
        try {
            console.log(`${LOG} world sync (${reason})…`);
            const live = syncBufferFromWorld(map);
            console.log(
                `${LOG} world sync done (${reason}): gen=${live.generators} terrainCol=${live.terrainCollectors} artefacts=${live.artefacts}`,
            );
        } catch (err) {
            console.warn(`${LOG} world sync failed (${reason})`, err);
        }
    };
    runWorldSync("immediate");
    try {
        setTimeout(() => runWorldSync("t+0ms"), 0);
        setTimeout(() => runWorldSync("t+500ms"), 500);
        setTimeout(() => runWorldSync("t+2000ms"), 2000);
    } catch { /* optional */ }
    try {
        sandkit.api.events.on("game:ready", () => runWorldSync("game:ready"));
    } catch { /* optional */ }
    try {
        sandkit.api.events.on("scene:game:started", () => runWorldSync("scene:game:started"));
    } catch { /* optional */ }

    safe(() => sandkit.api.ui.toast(`${MOD_ID} v${VERSION}`, {}));
    console.log(`${LOG} v${VERSION} enabled`);
}

function teardown(): void {
    if (!started) return;
    started = false;
    unregisterSpawnZoneOverlay();
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
