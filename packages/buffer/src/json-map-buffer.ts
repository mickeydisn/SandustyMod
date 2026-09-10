import "@sandmd/sandkit";
import { decodeJson, encodeJsonInBuffer } from "./utils/codec.ts";
import { listPaths } from "./utils/introspect.ts";
import { addToPath, deepClone, getPath, setPath } from "./utils/paths.ts";
import { ensureBuffer } from "./sand.ts";

const DEFAULT_MAX_BYTES = 64 * 1024;
const i32 = { min: -2147483648, max: 2147483647 };

/** Per-counter tuning for a mapped numeric leaf. */
export interface JsonMapCounterOptions {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
}

/** Shape passed to the JsonMapBuffer constructor. */
export interface JsonMapBufferConfig<T extends object = Record<string, unknown>> {
  /** Extra/override numeric counters (incl. specific array elements). */
  counters?: Record<string, JsonMapCounterOptions>;
  /** Optional validation guard, run on the materialized record on commit(). */
  assertShape?: (value: T) => void;
}

/**
 * A versioned JSON mailbox (same backbone as `JsonBuffer`) that ALSO keeps
 * every numeric leaf in its own tiny shared `Int32Array` counter, so workers
 * can do a race-free `+1` (or any clamp-bounded increment) with `increment()`.
 *
 * Each mapped path owns a 2-element shared buffer `${key}:map:<path>`:
 *   [0] = per-path LOG (monotonic, bumped each time that counter changes)
 *   [1] = the VALUE    (atomically read/written / CAS-incremented)
 *
 * Auto-discovered numeric leaves come from `defaultRecord` (via `listPaths`).
 * Array templates (paths containing `[]`) stay in the JSON payload; map a
 * specific element explicitly (e.g. `{ "scores[0]": {} }`) for counters in an
 * array. Non-counter leaves behave exactly like `JsonBuffer`. Counter reads
 * always come from the atomic buffer, never the JSON, and get()/commit()/save()
 * merge the live counter values back into the record.
 */
export class JsonMapBuffer<T extends object> {
    private versionView!: Int32Array;
    private dataView!: Uint8Array;
    public modId!: string;
    public key!: string;
    private defaultRecord?: T;
    private assertShape?: (value: T) => void;

    private cache: T;
    private localVersion: number;
    private useAtomics = true;

    /** path -> (shared Int32Array of length 2: [log, value]). */
    private map = new Map<string, Int32Array>();
    /** path -> tuning. `initial` stays undefined unless the caller set it. */
    private meta = new Map<string, { initial?: number; min: number; max: number; step: number }>();
    private order: string[] = [];

    private listeners = new Set<(state: T) => void>();
    private notify = () => {
        for (const fn of this.listeners) fn(this.state());
    };
    subscribe(fn: (state: T) => void) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    constructor(
        modId: string,
        key: string,
        defaultRecord?: T,
        config?: JsonMapBufferConfig<T>,
        loadFromStorage: boolean = false,
    ) {
        this.modId = modId;
        this.key = key;
        this.defaultRecord = defaultRecord;
        this.assertShape = config?.assertShape;

        this.versionView = ensureBuffer(`${key}:ver`, {
            type: "int32",
            length: 1,
        }) as Int32Array;
        try {
            Atomics.load(this.versionView, 0);
        } catch {
            this.useAtomics = false;
        }
        this.dataView = ensureBuffer(`${key}:json`, {
            type: "uint8",
            length: DEFAULT_MAX_BYTES,
        }) as Uint8Array;

        this.resolveCounters(defaultRecord, config);
        this.attachMapBuffers();

        if (this.remoteVersion() > 0) {
            this.cache = this.readFromBuffer();
            this.localVersion = this.remoteVersion();
        } else {
            const storedRecord = !loadFromStorage ? false : sandkit.api.storage.local.get(this.key);
            sandkit.api.events.on("store:save", (_payload: unknown) => {
                this.commit();
                this.save();
            });
            this.cache = storedRecord
                ? storedRecord as T
                : this.defaultRecord
                ? deepClone(this.defaultRecord)
                : ({} as T);
            // First creator: seed every shared counter from its current value.
            this.seedCounters();
            this.localVersion = -1;
            this.commit();
        }
    }

    // -- counter registry ---------------------------------------------------

    private resolveCounters(defaultRecord: T | undefined, config?: JsonMapBufferConfig<T>) {
        const explicit = config?.counters ?? {};
        const known = new Map<string, JsonMapCounterOptions>();
        for (const p of Object.keys(explicit)) known.set(p, explicit[p]);

        // Auto-discover numeric leaves (drop array templates, which stay in JSON).
        if (defaultRecord) {
            for (const field of listPaths(defaultRecord)) {
                if (field.kind !== "number") continue;
                if (field.path.includes("[]")) continue;
                if (!known.has(field.path)) known.set(field.path, {});
            }
        }

        this.order = [...known.keys()];
        for (const p of this.order) {
            const o = known.get(p) ?? {};
            this.meta.set(p, {
                initial: o.initial, // undefined unless the caller set it
                min: o.min ?? i32.min,
                max: o.max ?? i32.max,
                step: o.step ?? 1,
            });
        }
    }

    private attachMapBuffers() {
        for (const p of this.order) {
            const buf = ensureBuffer(`${this.key}:map:${p}`, {
                type: "int32",
                length: 2,
            }) as Int32Array;
            this.map.set(p, buf);
        }
    }

    /** Only seeds when we are the first creator (fresh / untouched buffer). */
    private seedCounters() {
        for (const p of this.order) {
            const buf = this.map.get(p)!;
            const meta = this.meta.get(p)!;
            const current = getPath<number>(this.cache, p);
            const value = meta.initial !== undefined
                ? meta.initial
                : typeof current === "number"
                ? current
                : 0;
            this.writeValue(buf, value);
            this.writeLog(buf, 0);
        }
    }

    // -- atomics plumbing (with plain-array fallback) ------------------------

    private readValue(buf: Int32Array): number {
        return this.useAtomics ? Atomics.load(buf, 1) : buf[1];
    }
    private writeValue(buf: Int32Array, v: number): void {
        if (this.useAtomics) Atomics.store(buf, 1, v);
        else buf[1] = v;
    }
    private readLog(buf: Int32Array): number {
        return this.useAtomics ? Atomics.load(buf, 0) : buf[0];
    }
    private writeLog(buf: Int32Array, v: number): void {
        if (this.useAtomics) Atomics.store(buf, 0, v);
        else buf[0] = v;
    }

    private remoteVersion = () =>
        this.useAtomics ? Atomics.load(this.versionView, 0) : this.versionView[0];

    private bumpGlobal(): number {
        this.localVersion = this.useAtomics
            ? Atomics.add(this.versionView, 0, 1) + 1
            : (this.versionView[0] += 1);
        return this.localVersion;
    }

    public version = () => this.localVersion;
    public hasUpdate = () => this.remoteVersion() !== this.localVersion;

    // -- public surface ------------------------------------------------------

    /** Paths currently mapped to atomic counters, in creation order. */
    public counterPaths = (): string[] => [...this.order];
    public isCounter = (path: string): boolean => this.map.has(path);
    /** Read the per-path change log for a mapped counter (0 if never bumped). */
    public log = (path: string): number => {
        const buf = this.map.get(path);
        return buf ? this.readLog(buf) : 0;
    };
    public logs = (): Record<string, number> => {
        const out: Record<string, number> = {};
        for (const p of this.order) out[p] = this.log(p);
        return out;
    };

    private readFromBuffer = (): T => decodeJson<T>(this.dataView) ?? ({} as T);

    /** Copy every live counter value back into `cache` (source of truth). */
    private materialize(): T {
        for (const p of this.order) {
            const v = this.readValue(this.map.get(p)!);
            setPath(this.cache, p, v);
        }
        return this.cache;
    }
    private state = (): T => this.materialize();

    public pull(): T | null {
        const remote = this.remoteVersion();
        if (remote === this.localVersion) return null;
        this.cache = this.readFromBuffer();
        this.localVersion = remote;
        this.notify();
        return this.materialize();
    }

    public get(): T {
        this.pull();
        return this.materialize();
    }

    public getPath(path: string): unknown {
        if (this.map.has(path)) return this.readValue(this.map.get(path)!);
        this.pull();
        return getPath(this.cache, path);
    }

    public listPaths(maxDepth = 8, includeContainers = true) {
        this.pull();
        return listPaths(this.materialize(), maxDepth, includeContainers);
    }

    /** Set a value. For a mapped counter this writes the atomic buffer + bumps
     *  its log; otherwise it mutates the JSON cache like JsonBuffer.setPath. */
    public setPath(path: string, value: unknown): void {
        const buf = this.map.get(path);
        if (buf) {
            const meta = this.meta.get(path)!;
            const clamped = clamp(Number(value), meta.min, meta.max);
            this.writeValue(buf, clamped);
            this.bumpLog(buf);
            this.changed();
            return;
        }
        setPath(this.cache, path, value);
    }

    /**
     * Race-free increment for a mapped counter. Uses a CAS loop so parallel
     * writers can never lose a step. Honors the counter's min/max bounds.
     * Falls back to a plain bump when Atomics is unavailable.
     * @returns the new value (post-clamp).
     */
    public increment(path: string, delta?: number): number {
        const buf = this.map.get(path);
        if (!buf) {
            throw new Error(
                `increment("${path}"): not a mapped atomic counter. ` +
                    `Map it in JsonMapBufferConfig.counters first.`,
            );
        }
        const meta = this.meta.get(path)!;
        const dn = Number(delta ?? meta.step);

        if (!this.useAtomics) {
            const next = clamp(buf[1] + dn, meta.min, meta.max);
            buf[1] = next;
            this.bumpLog(buf);
            this.changed();
            return next;
        }

        // CAS loop: never lose an update, respect min/max.
        let expected = Atomics.load(buf, 1);
        for (;;) {
            const next = clamp(expected + dn, meta.min, meta.max);
            if (next === expected) return expected; // at a bound / ∂=0
            if (Atomics.compareExchange(buf, 1, expected, next) === expected) {
                this.bumpLog(buf);
                this.changed();
                return next;
            }
            expected = Atomics.load(buf, 1); // someone else won; retry
        }
    }
    public decrement = (path: string, delta?: number): number =>
        this.increment(path, -(Number(delta ?? this.meta.get(path)?.step ?? 1)));

    public addToPath(path: string, value?: unknown): number {
        return addToPath(this.cache, path, value);
    }

    public replace(next: T): void {
        this.cache = deepClone(next);
    }

    public commit(): void {
        const record = this.materialize();
        this.assertShape?.(record);
        encodeJsonInBuffer(this.dataView, record);
        this.bumpGlobal();
        this.notify();
    }

    private bumpLog(buf: Int32Array): void {
        if (this.useAtomics) Atomics.add(buf, 0, 1);
        else buf[0] += 1;
    }
    /** A counter changed — bump the global version and wake subscribers. */
    private changed(): void {
        this.bumpGlobal();
        this.notify();
    }

    private save(): void {
        sandkit.api.storage.local.set(this.key, this.materialize());
    }
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}