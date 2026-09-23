/**
 * Shared refresh runner + optional auto-refresh timer.
 */
import { api, safe, toast } from "./api.ts";
import { getAutoRefreshEnabled, getConfig, intervalMs } from "./config.ts";
import { LOG } from "./constants.ts";
import { runScan } from "./data.ts";
import { bump, state } from "./state.ts";

let timer: ReturnType<typeof setInterval> | null = null;
let bootOnce = false;

export async function runRefresh(reason: string): Promise<void> {
    if (state.scanning) return;
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
    if (!getAutoRefreshEnabled()) return;
    if (!getConfig().enabled) return;

    const ms = intervalMs();
    timer = setInterval(() => {
        if (!getConfig().enabled || !getAutoRefreshEnabled()) {
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
        if (getAutoRefreshEnabled()) {
            void runRefresh("load");
            startAutoRefresh();
        }
    };

    safe(() => {
        api.events.on("game:ready", kick);
    });
    // If already in-world
    setTimeout(() => {
        if (getAutoRefreshEnabled() && getConfig().enabled && !state.snapshot) {
            kick();
        } else if (getAutoRefreshEnabled() && getConfig().enabled) {
            startAutoRefresh();
        }
    }, 1500);
}

export function reconfigureAutoRefresh(): void {
    stopAutoRefresh();
    if (getConfig().enabled && getAutoRefreshEnabled()) {
        startAutoRefresh();
    }
}
