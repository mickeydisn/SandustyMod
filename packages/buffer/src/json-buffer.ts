import "@sandmd/sandkit";
import { decodeJson, encodeJsonInBuffer } from "./utils/codec.ts";
import { listPaths, type ListPathsOptions } from "./utils/introspect.ts";
import { addToPath, deepClone, getPath, setPath } from "./utils/paths.ts";
import { ensureBuffer } from "./sand.ts";

export interface JsonBufferConfig<T extends object> {
    /** Mod that owns the record. */
    modId: string;
    /** Unique key used for shared memory and local storage. */
    key: string;
    /** Complete seed record used when shared memory/storage has no record. */
    defaultRecord: T;
    /** Maximum JSON payload size in bytes. */
    maxBytes: number;
    /** Save the record to local storage on `store:save`. */
    persist: boolean;
    /** Restore a persisted record during construction. */
    loadFromStorage: boolean;
    /** Observe-only mode: never commit and never touch storage. */
    observe: boolean;
    /** Optional validation guard run before every commit. */
    assertShape?: (value: T) => void;
}

export class JsonBuffer<T extends object> {
    private versionView!: Int32Array;
    private dataView!: Uint8Array;
    public modId!: string;
    public key!: string;
    private defaultRecord: T;
    private assertShape?: (value: T) => void;

    private cache: T;
    private localVersion: number;
    private useAtomics = true;

    private listeners = new Set<(state: T) => void>();
    private notify = () => {
        for (const fn of this.listeners) fn(this.cache);
    };
    subscribe(fn: (state: T) => void) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    constructor(config: JsonBufferConfig<T>) {
        this.modId = config.modId;
        this.key = config.key;
        this.defaultRecord = deepClone(config.defaultRecord);
        this.assertShape = config.assertShape;
        this.assertShape?.(this.defaultRecord);
        if (!Number.isInteger(config.maxBytes) || config.maxBytes <= 0) {
            throw new Error(
                `JsonBuffer: maxBytes must be a positive integer (${config.maxBytes}).`,
            );
        }

        this.versionView = ensureBuffer(`${config.key}:ver`, {
            type: "int32",
            length: 1,
        }) as Int32Array;
        // sandkit's shared buffers are backed by SharedArrayBuffer, so Atomics
        // work; fall back to plain reads/writes if the host returns a plain buffer.
        try {
            Atomics.load(this.versionView, 0);
        } catch {
            // console.log("ATOMIC ---");
            this.useAtomics = false;
        }
        this.dataView = ensureBuffer(`${config.key}:json`, {
            type: "uint8",
            length: config.maxBytes,
        }) as Uint8Array;

        if (this.remoteVersion() > 0) {
            this.cache = this.readFromBuffer();
            this.localVersion = this.remoteVersion();
        } else if (config.observe) {
            // Observe mode: wait for a main-thread commit instead of writing
            // defaults (a worker committing first would clobber the persisted
            // record before the main thread restores it).
            this.cache = deepClone(this.defaultRecord);
            this.localVersion = this.remoteVersion();
        } else {
            // LongTerm Storage
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
            this.localVersion = -1;
            this.commit();
        }
        this.assertShape?.(this.cache);
    }

    public remoteVersion = () => {
        return this.useAtomics ? Atomics.load(this.versionView, 0) : this.versionView[0];
    };
    public version = () => {
        return this.localVersion;
    };

    private readFromBuffer = (): T => {
        const record = decodeJson<T>(this.dataView);
        if (record === null) {
            throw new Error(`JsonBuffer: shared payload for "${this.key}" is empty or corrupt.`);
        }
        return record;
    };

    public pull(): T | null {
        const remote = this.remoteVersion();
        if (remote === this.localVersion) return null;
        this.cache = this.readFromBuffer();
        this.localVersion = remote;
        this.notify();
        return this.cache;
    }

    public hasUpdate = () => this.remoteVersion() !== this.localVersion;

    public get() {
        this.pull();
        return this.cache;
    }
    public getPath(path: string) {
        this.pull();
        return getPath(this.cache, path);
    }
    public listPaths(options: ListPathsOptions) {
        this.pull();
        return listPaths(this.cache, options);
    }

    public setPath(path: string, value: unknown) {
        setPath(this.cache, path, value);
    }

    public addToPath(path: string, value: unknown) {
        addToPath(this.cache, path, value);
    }

    public replace(next: T) {
        this.cache = deepClone(next);
    }

    public commit() {
        this.assertShape?.(this.cache);
        encodeJsonInBuffer(this.dataView, this.cache);
        // Bump the SHARED version counter atomically so sibling workers/instances
        // see the new version; falls back to a plain write when Atomics is unavailable.
        this.localVersion = this.useAtomics
            ? Atomics.add(this.versionView, 0, 1) + 1
            : (this.versionView[0] += 1);
        this.notify();
    }

    private save() {
        sandkit.api.storage.local.set(this.key, this.cache);
    }
}
