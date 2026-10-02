/**
 * The merged **Tracking Configuration** section, shared by both statistic mods.
 *
 * Three numbers live here: the auto-refresh cadence (`timeRange`) and the two
 * history-window sizes (`maxCountSave`, `historyMax`). Both mods expose them as
 * one section with identical rows, so the renderer below is shared rather than
 * written twice — the two settings tabs cannot drift apart.
 *
 * ## Why this does NOT live in `api.settings`
 *
 * The engine's settings API is **read-only**: `get`, `getAll`, `onChange`. There
 * is no `set`. A mod therefore *cannot* write its own `configSchema` values, and
 * `api.settings.set?.(k, v)` is a silent no-op.
 *
 * That bug was live in both mods and showed up differently:
 *
 * - `md-word-statistic` kept no cache, so `getConfig()` re-read the engine bag,
 *   got the old number back, and the steppers looked frozen — "I can't change
 *   these". Nothing was ever written: the mod had no `externalModSettings` entry
 *   at all.
 * - `md-player-statistic` masked the same no-op behind an in-memory cache, so its
 *   numbers moved in-session and then reverted on the next launch. That is worse,
 *   because it looks like it works.
 *
 * So these three persist in `api.storage`, which both mods already use for panel
 * position, zoom, cards and history, and which demonstrably survives a reload.
 * The engine bag **seeds** them on the very first read, so a value set in the
 * game's own mod-settings screen is picked up rather than clobbered; after that
 * the panel is the source of truth.
 */
import { api, h, safe } from "./api.ts";
import { CfgSection, NumberRow } from "./section.ts";

/** Section heading, identical in both mods. */
export const TRACKING_SECTION = "Tracking Configuration";

export interface TrackingConfig {
    /** Minutes between history points; also the world-scan interval. */
    timeRange: number;
    /** Max stored data points (FIFO, oldest dropped). */
    maxCountSave: number;
    /** Points rendered on sparklines and charts. */
    historyMax: number;
}

export type TrackingKey = keyof TrackingConfig;

/** Row definition for one tracking setting. */
export interface TrackingField {
    /** Label shown on the left of the row. */
    label: string;
    min: number;
    max: number;
    step: number;
    /** Restored by the row's Reset button; also the fallback default. */
    def: number;
    /** Appended to the displayed value, e.g. `" min"`. */
    suffix?: string;
}

/**
 * Row order here is the on-screen order. Keep it stable — a reshuffle would move
 * rows out from under the user's mouse and silently repurpose each value.
 *
 * Both history sizes step by 10: these are window sizes, not precise knobs, and
 * a 1-at-a-time stepper on a 5–200 range takes 195 clicks to cross it. The
 * ranges are multiples of the step so no value is stranded — with a `min` of 10
 * and a step of 10 the row parks cleanly on the floor instead of clamping to a
 * stray 5 and then stepping to 15.
 */
export const TRACKING_FIELDS: Record<TrackingKey, TrackingField> = {
    timeRange: { label: "Every", min: 1, max: 1440, step: 1, def: 2, suffix: " min" },
    maxCountSave: { label: "Max data points", min: 10, max: 2000, step: 10, def: 120 },
    historyMax: { label: "Display points", min: 10, max: 200, step: 10, def: 30 },
};

const TRACKING_KEYS = Object.keys(TRACKING_FIELDS) as TrackingKey[];

/** Row order to render in. */
export function trackingKeys(): TrackingKey[] {
    return [...TRACKING_KEYS];
}

function clampField(key: TrackingKey, v: unknown): number {
    const spec = TRACKING_FIELDS[key];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return spec.def;
    return Math.min(spec.max, Math.max(spec.min, Math.round(n)));
}

export interface TrackingStore {
    /** Current values, clamped. Cached after the first read. */
    read(): TrackingConfig;
    /** Clamp, persist, and return the whole bag. */
    write(key: TrackingKey, value: number): TrackingConfig;
    /**
     * Write `value` only if the field has no value anywhere yet.
     *
     * Used to adopt a value from wherever it used to live — a setting the mod
     * could never write, or a separate storage key it has now folded in. "No
     * value" means neither the mod's own storage nor the engine bag has a
     * usable number for the field, so a first run is the only thing that
     * triggers it and a later edit is never clobbered.
     */
    writeIfAbsent(key: TrackingKey, value: number): TrackingConfig;
    /** Force a re-read from storage + the engine bag. */
    refresh(): TrackingConfig;
    /** Where the values live, for logging. */
    readonly storageKey: string;
}

/**
 * Build a persistent store for one mod's tracking settings.
 *
 * @param modId      storage namespace (the mod id)
 * @param storageKey single key holding all three numbers
 * @param legacy     older engine-bag key to honour per field on first read
 */
export function createTrackingStore(
    modId: string,
    storageKey = "tracking",
    legacy: Partial<Record<TrackingKey, string>> = {},
): TrackingStore {
    const readRaw = (): Partial<TrackingConfig> => {
        const v = safe(
            () => api.storage.get(modId, storageKey) as Partial<TrackingConfig>,
            null,
        );
        return v && typeof v === "object" ? v : {};
    };

    /**
     * Storage wins; the engine bag fills gaps only. That ordering is what makes
     * a first run adopt an existing in-game setting, while every later change
     * stays in the panel's own storage.
     *
     * `legacy` is consulted before the current key, so an install that predates a
     * rename keeps its cadence instead of snapping back to the default.
     */
    const normalise = (raw: Partial<TrackingConfig> | null): TrackingConfig => {
        const seed = safe(
            () => api.settings?.getAll?.() as Partial<TrackingConfig> | undefined,
            undefined,
        ) ?? {};
        const out = {} as TrackingConfig;
        for (const key of TRACKING_KEYS) {
            const old = legacy[key];
            const v = raw?.[key] ??
                seed[key] ??
                (old ? (seed as Record<string, unknown>)[old] : undefined);
            out[key] = clampField(key, v);
        }
        return out;
    };

    let cache: TrackingConfig | null = null;

    const read = (): TrackingConfig => {
        if (cache == null) cache = normalise(readRaw());
        return cache;
    };

    return {
        storageKey,
        read,
        write(key, value) {
            const next = normalise({ ...readRaw(), [key]: value });
            cache = next;
            safe(() => api.storage.set(modId, storageKey, next));
            return next;
        },
        writeIfAbsent(key, value) {
            const raw = readRaw();
            if (typeof raw[key] === "number" && Number.isFinite(raw[key])) return read();
            const seed = safe(
                () => api.settings?.getAll?.() as Record<string, unknown> | undefined,
                undefined,
            ) ?? {};
            const old = legacy[key];
            const fromEngine = seed[key] ??
                (old ? (seed as Record<string, unknown>)[old] : undefined);
            if (typeof fromEngine === "number" && Number.isFinite(fromEngine)) return read();
            return this.write(key, value);
        },
        refresh() {
            cache = normalise(readRaw());
            return cache;
        },
    };
}

/**
 * The whole **Tracking Configuration** section: heading plus one row per field.
 *
 * `onChange` receives the key so the caller can apply side effects — the word
 * mod restarts its scan timer when `timeRange` changes.
 */
export function renderTrackingSection(
    cfg: TrackingConfig,
    onChange: (key: TrackingKey, value: number) => void,
    marginTop = 14,
): unknown {
    const e = h;
    if (!e) return null;
    return e(
        "div",
        null,
        CfgSection(TRACKING_SECTION, marginTop),
        ...TRACKING_KEYS.map((key) => {
            const spec = TRACKING_FIELDS[key];
            return NumberRow(spec.label, cfg[key], {
                min: spec.min,
                max: spec.max,
                step: spec.step,
                def: spec.def,
                suffix: spec.suffix,
                onChange: (v) => onChange(key, v),
            });
        }),
    );
}