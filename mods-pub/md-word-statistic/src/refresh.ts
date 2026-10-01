/**
 * Shared refresh runner + optional auto-refresh timer.
 */
import { api, safe, toast } from "@sandmd/ui";
import { autoRefreshAlwaysOn, getConfig, intervalMs } from "./config.ts";
import { LOG } from "./constants.ts";
import { runScan } from "./data.ts";
import { bump, ensureCardsLoaded, state } from "./state.ts";

let timer: ReturnType<typeof setInterval> | null = null;
let bootOnce = false;

export async function runRefresh(reason: string): Promise<void> {
    if (state.scanning) return;
    // The scan resolves the Home cards from `state.cards`, and it does not wait
    // for the overlay: the boot auto-refresh can run and finish before the panel
    // has ever mounted. Load the config here or the snapshot bakes in an empty
    // card list and the Home tab stays blank until the game is restarted.
    ensureCardsLoaded();
    state.scanning = true;
    bump();
    toast(`World Statistic: sync started (${reason})`);
    console.log(`${LOG} sync start`, reason);
    try {
        const next = await runScan(undefined, state.cards);
        state.snapshot = next;
        toast(`World Statistic: sync done · ${next.durationMs} ms`);
        console.log(`${LOG} sync end`, next.durationMs, "ms");
    } catch (err) {
        console.error(`${LOG} sync failed`, err);
        toast("World Statistic: sync failed");
    } finally {
        state.scanning = false;
        bump();
    }
}

export function stopAutoRefresh(): void {
    if (timer != null) {
        clearInterval(timer);
        timer = null;
    }
}

export function startAutoRefresh(): void {
    stopAutoRefresh();
    if (!autoRefreshAlwaysOn()) return;
    if (!getConfig().enabled) return;

    const ms = intervalMs();
    timer = setInterval(() => {
        if (!getConfig().enabled) {
            stopAutoRefresh();
            return;
        }
        void runRefresh("auto");
    }, ms);
    console.log(`${LOG} auto-refresh every ${ms / 60000} min`);
}

/** Call once game is ready: optional first scan + start interval. */
export function bindAutoRefreshLifecycle(): void {
    if (bootOnce) return;
    bootOnce = true;

    const kick = (): void => {
        if (!getConfig().enabled) return;
        if (autoRefreshAlwaysOn()) {
            void runRefresh("load");
            startAutoRefresh();
        }
    };

    safe(() => {
        api.events.on("game:ready", kick);
    });
    // If already in-world
    setTimeout(() => {
        if (autoRefreshAlwaysOn() && getConfig().enabled && !state.snapshot) {
            kick();
        } else if (autoRefreshAlwaysOn() && getConfig().enabled) {
            startAutoRefresh();
        }
    }, 1500);
}

export function reconfigureAutoRefresh(): void {
    stopAutoRefresh();
    if (getConfig().enabled && autoRefreshAlwaysOn()) {
        startAutoRefresh();
    }
}
