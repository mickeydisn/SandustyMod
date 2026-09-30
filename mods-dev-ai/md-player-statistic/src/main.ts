/**
 * md-player-statistic — entry point.
 *
 * Event-driven player KPI tracker. No world scan: counters are fed from
 * sandkit events (building place/remove/move, item:used, terrain:destroyed,
 * worldItem:pickedUp, resource:collected) into a live buffer persisted via
 * api.storage. Users configure Home KPI cards in the overlay.
 */
import { bootBuffer, flush, pushHistory } from "./buffer.ts";
import { bindSettings, getConfig, onConfigChange } from "./config.ts";
import { runCleanup, runDisableCleanup } from "./cleanup.ts";
import { LOG, VERSION } from "./constants.ts";
import { bindEvents, unbindEvents } from "./events.ts";
import { registerTool } from "./tool.ts";

let started = false;
let historyTimer: ReturnType<typeof setInterval> | null = null;

function startHistoryTimer(maxDepth: number): void {
    stopHistoryTimer();
    // Snapshot totals every 60s for sparklines
    historyTimer = setInterval(() => {
        pushHistory(maxDepth);
    }, 60_000);
}

function stopHistoryTimer(): void {
    if (historyTimer != null) {
        clearInterval(historyTimer);
        historyTimer = null;
    }
}

async function main(): Promise<void> {
    if (started) return;
    started = true;

    const cfg = getConfig();
    bootBuffer(cfg.persistSession);
    bindEvents();
    await registerTool();
    startHistoryTimer(cfg.historyMax);

    // Initial history point
    pushHistory(cfg.historyMax);

    console.log(`${LOG} v${VERSION} enabled`);
}

function teardown(): void {
    if (!started) return;
    started = false;
    stopHistoryTimer();
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
            startHistoryTimer(next.historyMax);
        }
    });

    console.log(`${LOG} v${VERSION} loaded`, cfg);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runDisableCleanup("init-error");
}
