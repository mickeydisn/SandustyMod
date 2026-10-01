/**
 * md-player-statistic — entry point.
 *
 * Event-driven player KPI tracker. No world scan: counters are fed from
 * sandkit events (building place/remove/move, item:used, terrain:destroyed,
 * worldItem:pickedUp, resource:collected) into a live buffer persisted via
 * api.storage. Users configure Home KPI cards in the overlay.
 */
import { bootBuffer, flush, pushHistory } from "./buffer.ts";
import { api, safe } from "@sandmd/ui";
import { bindActivity, unbindActivity } from "./activity.ts";
import { bindSettings, getConfig, onConfigChange } from "./config.ts";
import { runCleanup, runDisableCleanup } from "./cleanup.ts";
import { LOG, VERSION } from "./constants.ts";
import { bindEvents, unbindEvents } from "./events.ts";
import {
    ensureToolInInventory,
    registerTool,
    startInventoryWatch,
    stopInventoryWatch,
} from "./tool.ts";

let started = false;
let historyTimer: ReturnType<typeof setInterval> | null = null;
let worldUnsubs: (() => void)[] = [];

/**
 * Record one data point every `intervalMinutes`. Re-created whenever the
 * setting changes, so the sampling rate follows the config.
 */
function startHistoryTimer(intervalMinutes: number): void {
    stopHistoryTimer();
    const ms = Math.max(1, intervalMinutes) * 60_000;
    historyTimer = setInterval(() => {
        pushHistory(getConfig().maxCountSave);
    }, ms);
}

function stopHistoryTimer(): void {
    if (historyTimer != null) {
        clearInterval(historyTimer);
        historyTimer = null;
    }
}

/**
 * The mod boots at the main menu, where there is no player and no inventory,
 * so the first `addById` is a no-op. Re-offer the tool when a world starts and
 * keep retrying for a while — otherwise it is absent from the hotbar and the
 * overlay, which is gated on the tool being selected, can never open.
 *
 * Only `game:started` is used: it is the one world-start event the engine
 * actually emits on the main thread (`game:ready` is listened to everywhere but
 * never emitted there).
 */
function bindWorldHooks(): void {
    unbindWorldHooks();
    const u = safe(() =>
        api.events?.on?.("game:started", () => {
            ensureToolInInventory();
            startInventoryWatch();
        })
    );
    if (typeof u === "function") worldUnsubs.push(u as () => void);
}

function unbindWorldHooks(): void {
    for (const u of worldUnsubs) {
        try {
            u?.();
        } catch { /* */ }
    }
    worldUnsubs = [];
}

async function main(): Promise<void> {
    if (started) return;
    started = true;

    const cfg = getConfig();
    bootBuffer(cfg.persistSession);
    bindEvents();
    bindActivity();
    await registerTool();
    bindWorldHooks();
    // Covers the case where a world is already active at boot.
    startInventoryWatch();
    startHistoryTimer(cfg.timeRange);

    // Initial history point
    pushHistory(cfg.maxCountSave);

    console.log(`${LOG} v${VERSION} enabled`);
}

function teardown(): void {
    if (!started) return;
    started = false;
    stopHistoryTimer();
    stopInventoryWatch();
    unbindWorldHooks();
    unbindActivity();
    unbindEvents();
    flush();
}

function applyEnabled(enabled: boolean, reason: string): void {
    if (enabled) {
        void main();
        return;
    }
    teardown();
    runDisableCleanup(reason);
    console.log(`${LOG} v${VERSION} disabled — listeners, tool, storage wiped`);
}

try {
    bindSettings();
    const cfg = getConfig();

    if (cfg.enabled) {
        void main();
    } else {
        runDisableCleanup("boot-disabled");
        console.log(`${LOG} v${VERSION} loaded (disabled)`);
    }

    onConfigChange((next) => {
        runCleanup("config-change");
        applyEnabled(next.enabled, "config-change");
        if (next.enabled) {
            startHistoryTimer(next.timeRange);
        }
    });

    // Stringified on purpose: a bare object arg renders as "Object" in the
    // console, which tells you nothing when a setting misbehaves.
    console.log(`${LOG} v${VERSION} loaded ${JSON.stringify(cfg)}`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runDisableCleanup("init-error");
}
