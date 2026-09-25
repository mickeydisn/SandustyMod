import "@sandmd/sandkit";
import { decodeJson, encodeJsonInBuffer } from "./utils/codec.ts";
import { listPaths, type ListPathsOptions } from "./utils/introspect.ts";
import { addToPath, deepClone, getPath, setPath } from "./utils/paths.ts";
import { ensureBuffer } from "./sand.ts";

export interface JsonMapCounterOptions {
    min: number;
    max: number;
}

/** Complete configuration passed to JsonMapBuffer. */
export interface JsonMapBufferConfig<T extends object = Record<string, unknown>> {
    modId: string;
    key: string;
    defaultRecord: T;
    maxBytes: number;
    /** Every mapped path and its explicit bounds. */
    counters: Record<string, JsonMapCounterOptions>;
    /** Save the record to local storage on `store:save`. */
    persist: boolean;
    loadFromStorage: boolean;
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
 * Every mapped path is declared in `config.counters` with explicit bounds; there is no implicit
 * numeric-path discovery. Array templates (paths containing `[]`) stay in the JSON payload; map a
 * specific element explicitly (e.g. `{ "scores[0]": { min: 0, max: 10 } }`). Non-counter leaves
 * behave like `JsonBuffer`. Counter reads always come from the atomic buffer, never the JSON, and
 * get()/commit()/save() merge the live counter values back into the record.
 */
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

export class JsonMapBuffer<T extends object> {
    private versionView!: Int32Array;
    private dataView!: Uint8Array;
    public modId!: string;
    public key!: string;
    private defaultRecord: T;
    private assertShape?: (value: T) => void;

    private cache: T;
    private localVersion: number;
    private useAtomics = true;

    /** path -> (shared Int32Array of length 2: [log, value]). */
    private map = new Map<string, Int32Array>();
    private meta = new Map<string, { min: number; max: number }>();
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

    constructor(config: JsonMapBufferConfig<T>) {
        this.modId = config.modId;
        this.key = config.key;
        this.defaultRecord = deepClone(config.defaultRecord);
        this.assertShape = config.assertShape;
        this.assertShape?.(this.defaultRecord);
        if (!Number.isInteger(config.maxBytes) || config.maxBytes <= 0) {
            throw new Error(
                `JsonMapBuffer: maxBytes must be a positive integer (${config.maxBytes}).`,
            );
        }

        this.versionView = ensureBuffer(`${config.key}:ver`, {
            type: "int32",
            length: 1,
        }) as Int32Array;
        try {
            Atomics.load(this.versionView, 0);
        } catch {
            this.useAtomics = false;
        }
        this.dataView = ensureBuffer(`${config.key}:json`, {
            type: "uint8",
            length: config.maxBytes,
        }) as Uint8Array;

        this.resolveCounters(config);
        this.attachMapBuffers();

        if (this.remoteVersion() > 0) {
            this.cache = this.readFromBuffer();
            this.localVersion = this.remoteVersion();
        } else {
            const storedRecord = config.loadFromStorage
                ? sandkit.api.storage.local.get(config.key)
                : undefined;
            if (config.persist) {
                sandkit.api.events.on("store:save", (_payload: unknown) => {
                    this.commit();
                    this.save();
                });
            }
            this.cache = storedRecord !== null && storedRecord !== undefined
                ? deepClone(storedRecord as T)
                : deepClone(this.defaultRecord);
            // First creator: seed every shared counter from its current value.
            this.seedCounters();
            this.localVersion = -1;
            this.commit();
        }
        this.assertShape?.(this.cache);
    }

    // -- counter registry ---------------------------------------------------

    private resolveCounters(config: JsonMapBufferConfig<T>) {
        const known = new Map<string, JsonMapCounterOptions>(Object.entries(config.counters));
        this.order = [...known.keys()];
        for (const path of this.order) {
            const options = known.get(path);
            if (!options) {
                throw new Error(`JsonMapBuffer: counter "${path}" has no configuration.`);
            }
            if (
                !Number.isInteger(options.min) ||
                !Number.isInteger(options.max) ||
                options.min < INT32_MIN ||
                options.max > INT32_MAX ||
                options.min > options.max
            ) {
                throw new Error(`JsonMapBuffer: counter "${path}" has invalid int32 bounds.`);
            }
            const initial = getPath<number>(config.defaultRecord, path);
            if (typeof initial !== "number" || !Number.isInteger(initial)) {
                throw new Error(
                    `JsonMapBuffer: counter path "${path}" must be an integer in defaultRecord.`,
                );
            }
            this.meta.set(path, { min: options.min, max: options.max });
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
        for (const path of this.order) {
            const buf = this.map.get(path)!;
            const meta = this.meta.get(path)!;
            const current = getPath<number>(this.cache, path);
            if (typeof current !== "number" || !Number.isInteger(current)) {
                throw new Error(
                    `JsonMapBuffer: counter path "${path}" is not an integer in the seed record.`,
                );
            }
            if (current < meta.min || current > meta.max) {
                throw new Error(
                    `JsonMapBuffer: counter path "${path}" starts outside its configured bounds.`,
                );
            }
            this.writeValue(buf, current);
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
        if (!buf) throw new Error(`JsonMapBuffer: "${path}" is not a mapped counter.`);
        return this.readLog(buf);
    };
    public logs = (): Record<string, number> => {
        const out: Record<string, number> = {};
        for (const p of this.order) out[p] = this.log(p);
        return out;
    };

    private readFromBuffer = (): T => {
        const record = decodeJson<T>(this.dataView);
        if (record === null) {
            throw new Error(`JsonMapBuffer: shared payload for "${this.key}" is empty or corrupt.`);
        }
        return record;
    };

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

    public listPaths(options: ListPathsOptions) {
        this.pull();
        return listPaths(this.materialize(), options);
    }

    /** Set a value. For a mapped counter this writes the atomic buffer + bumps
     *  its log; otherwise it mutates the JSON cache like JsonBuffer.setPath. */
    public setPath(path: string, value: unknown): void {
        const buf = this.map.get(path);
        if (buf) {
            const numeric = Number(value);
            if (!Number.isInteger(numeric)) {
                throw new Error(`JsonMapBuffer: value for "${path}" must be an integer.`);
            }
            const meta = this.meta.get(path)!;
            const clamped = clamp(numeric, meta.min, meta.max);
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
    public increment(path: string, delta: number): number {
        const buf = this.map.get(path);
        if (!buf) {
            throw new Error(
                `increment("${path}"): not a mapped atomic counter. ` +
                    `Map it in JsonMapBufferConfig.counters first.`,
            );
        }
        const meta = this.meta.get(path)!;
        if (!Number.isInteger(delta)) {
            throw new Error(`JsonMapBuffer: increment delta for "${path}" must be an integer.`);
        }
        const dn = delta;

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
    public decrement = (path: string, delta: number): number => this.increment(path, -delta);

    public addToPath(path: string, value: unknown): number {
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
