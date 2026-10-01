/**
 * Panel UI preferences in mod storage (not configSchema).
 *
 * Both statistic mods persist the same six things — position, zoom, opacity,
 * lock, minimize, and an auto-refresh override — but historically used
 * different key names and different clamps. `createUiStore` takes the mod id,
 * a key prefix, and the clamps so each mod keeps its own stored values while
 * the read/write/clamp logic lives here once.
 */
import { api, safe } from "./api.ts";
import type { PanelPos, UiStoreKeys, UiStoreOptions } from "./types.ts";

const DEFAULT_POS: PanelPos = { right: 16, top: 80 };

export interface UiStore {
    readonly posKey: string;
    readonly zoomKey: string;
    readonly alphaKey: string;
    readonly lockKey: string;
    readonly miniKey: string;
    readonly autoKey: string;
    loadPanelPos(): PanelPos;
    savePanelPos(pos: PanelPos): void;
    loadMinimized(): boolean;
    saveMinimized(v: boolean): void;
    loadLocked(): boolean;
    saveLocked(v: boolean): void;
    loadZoom(): number;
    saveZoom(v: number): void;
    loadAlpha(): number;
    saveAlpha(v: number): void;
    /** Panel override for auto-refresh minutes; null = use mod config. */
    loadAutoMinutes(): number | null;
    saveAutoMinutes(v: number | null): void;
}

/**
 * Explicit storage key names, overriding the `${keyPrefix}${suffix}` default.
 * Needed where a mod already persisted its prefs under older names — those
 * installs must not silently lose their panel position on upgrade.
 */

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

export function createUiStore(opts: UiStoreOptions): UiStore {
    const { modId, keyPrefix } = opts;
    const [zLo, zHi] = opts.zoomRange ?? [0.6, 1.4];
    const [aLo, aHi] = opts.alphaRange ?? [0.35, 1];
    const [mLo, mHi] = opts.autoMinutesRange ?? [1, 20];

    const posKey = opts.keys?.pos ?? `${keyPrefix}Position`;
    const zoomKey = opts.keys?.zoom ?? `${keyPrefix}Zoom`;
    const alphaKey = opts.keys?.alpha ?? `${keyPrefix}Alpha`;
    const lockKey = opts.keys?.lock ?? `${keyPrefix}Locked`;
    const miniKey = opts.keys?.mini ?? `${keyPrefix}Minimized`;
    const autoKey = opts.keys?.auto ?? `${keyPrefix}AutoMinutes`;

    const read = <T>(key: string): T | null => safe(() => api.storage.get(modId, key) as T, null);

    const write = (key: string, value: unknown): void => {
        safe(() => api.storage.set(modId, key, value));
    };

    return {
        posKey,
        zoomKey,
        alphaKey,
        lockKey,
        miniKey,
        autoKey,

        loadPanelPos(): PanelPos {
            const raw = read<Record<string, unknown>>(posKey);
            if (raw && typeof raw === "object") {
                const o = raw as Record<string, unknown>;
                if (typeof o.right === "number" && typeof o.top === "number") {
                    return { right: o.right, top: o.top };
                }
                // Migrate old left/top → approximate right (assume ~40vw panel).
                if (typeof o.left === "number" && typeof o.top === "number" && o.left >= 0) {
                    const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
                    return { right: Math.max(0, vw - o.left - vw * 0.4), top: o.top };
                }
            }
            return { ...DEFAULT_POS };
        },
        savePanelPos(pos: PanelPos): void {
            write(posKey, pos);
        },

        loadMinimized(): boolean {
            return read<unknown>(miniKey) === true;
        },
        saveMinimized(v: boolean): void {
            write(miniKey, v);
        },

        loadLocked(): boolean {
            return read<unknown>(lockKey) === true;
        },
        saveLocked(v: boolean): void {
            write(lockKey, v);
        },

        loadZoom(): number {
            const v = read<unknown>(zoomKey);
            return typeof v === "number" && Number.isFinite(v) ? clamp(v, zLo, zHi) : 1;
        },
        saveZoom(v: number): void {
            write(zoomKey, clamp(v, zLo, zHi));
        },

        loadAlpha(): number {
            const v = read<unknown>(alphaKey);
            return typeof v === "number" && Number.isFinite(v) ? clamp(v, aLo, aHi) : 1;
        },
        saveAlpha(v: number): void {
            write(alphaKey, clamp(v, aLo, aHi));
        },

        loadAutoMinutes(): number | null {
            const v = read<unknown>(autoKey);
            if (typeof v === "number" && Number.isFinite(v)) {
                return Math.round(clamp(v, mLo, mHi));
            }
            return null;
        },
        saveAutoMinutes(v: number | null): void {
            if (v === null) {
                safe(() => api.storage.remove?.(modId, autoKey));
                return;
            }
            write(autoKey, Math.round(clamp(v, mLo, mHi)));
        },
    };
}
