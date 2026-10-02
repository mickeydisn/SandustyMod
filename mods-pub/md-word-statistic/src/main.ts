/**
 * md-word-statistic — entry point.
 *
 * Always runs orphan/building cleanup.
 * When enabled: register tool + overlay, optional auto-refresh.
 * When disabled: remove tool item and skip UI.
 */
import { adoptLegacyAutoMinutes, getConfig, onConfigChange } from "./config.ts";
import { LOG, VERSION } from "./constants.ts";
import { removeToolItem, runCleanup, runDisableCleanup } from "./cleanup.ts";
import { bindAutoRefreshLifecycle, reconfigureAutoRefresh, stopAutoRefresh } from "./refresh.ts";
import { registerTool } from "./tool.ts";
import { loadPanelAutoMinutes } from "./uiStore.ts";

async function startEnabled(): Promise<void> {
    await registerTool();
    bindAutoRefreshLifecycle();
}

function applyEnabled(enabled: boolean): void {
    if (!enabled) {
        stopAutoRefresh();
        runDisableCleanup("disabled");
        console.log(`${LOG} disabled — tool, overlay, storage wiped`);
        return;
    }
    void startEnabled();
    reconfigureAutoRefresh();
}

try {
    runCleanup("boot");

    // Before anything reads the cadence, fold in the value the old panel override
    // held; from here on `timeRange` is the only place it lives.
    adoptLegacyAutoMinutes(loadPanelAutoMinutes());

    const cfg = getConfig();
    if (cfg.enabled) {
        await startEnabled();
    } else {
        runDisableCleanup("boot-disabled");
        console.log(`${LOG} v${VERSION} loaded (disabled)`);
    }

    onConfigChange((next) => {
        runCleanup("config-change");
        applyEnabled(next.enabled);
        if (next.enabled) reconfigureAutoRefresh();
    });

    console.log(`${LOG} v${VERSION} loaded`, cfg);
} catch (e) {
    console.error(`${LOG} init failed`, e);
    runCleanup("init-error");
}
