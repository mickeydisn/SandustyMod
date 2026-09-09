import "@sandmd/sandkit";
import { decodeJson, encodeJsonInBuffer } from "./utils/codec.ts";
import { listPaths } from "./utils/introspect.ts";
import { addToPath, deepClone, getPath, setPath } from "./utils/paths.ts";
import { ensureBuffer } from "./sand.ts";

const DEFAULT_MAX_BYTES = 64 * 1024;

export class JsonBuffer<T extends object> {
    private versionView!: Int32Array;
    private dataView!: Uint8Array;
    public modId!: string;
    public key!: string;
    private defaultRecord?: T;
    private assertShape?: (value: T) => void;

    private cache: T;
    private localVersion: number;

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

    constructor(
        modId: string,
        key: string,
        defaultRecord?: T,
        assertShape?: (value: T) => void,
        loadFromStorage: boolean = false,
    ) {
        this.modId = modId;
        this.key = key;
        this.defaultRecord = defaultRecord;
        this.assertShape = assertShape;

        this.versionView = ensureBuffer(`${key}:ver`, {
            type: "int32",
            length: 1,
        }) as Int32Array;
        this.dataView = ensureBuffer(`${key}:json`, {
            type: "uint8",
            length: DEFAULT_MAX_BYTES,
        }) as Uint8Array;

        if (this.remoteVersion() > 0) {
            this.cache = this.readFromBuffer();
            this.localVersion = this.remoteVersion();
        } else {
            // LongTerm Storage
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
            this.localVersion = -1;
            this.commit();
        }
    }

    public remoteVersion = () => {
        return this.versionView[0];
    };
    public version = () => {
        return this.localVersion;
    };

    private readFromBuffer = (): T => {
        const record: T = decodeJson<T>(this.dataView) ?? ({} as T);
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
    public listPaths(
        /** How deep to recurse into nested objects/arrays. Default 8. */
        maxDepth: number = 8,
        /** Also list object/array container paths themselves (e.g. "players" as kind "array"), not just their leaves/templates. Default false. */
        includeContainers: boolean = true,
    ) {
        this.pull();
        return listPaths(this.cache, maxDepth, includeContainers);
    }

    public setPath(path: string, value: unknown) {
        setPath(this.cache, path, value);
    }

    public addToPath(path: string, value?: unknown) {
        addToPath(this.cache, path, value);
    }

    public replace(next: T) {
        this.cache = deepClone(next);
    }

    public commit() {
        this.assertShape?.(this.cache);
        encodeJsonInBuffer(this.dataView, this.cache);
        this.localVersion = this.remoteVersion() + 1;
        this.notify();
    }

    private save() {
        sandkit.api.storage.local.set(this.key, this.cache);
    }
}
