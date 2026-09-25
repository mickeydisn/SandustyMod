/**
 * BufferHandle — the storage-agnostic surface shared by `JsonBuffer` and
 * `JsonMapBuffer`.
 *
 * The two classes are independent (neither extends the other) and each carries
 * private fields, so TypeScript treats them as nominally distinct even though
 * a consumer can drive either one. A consumer that only needs the common
 * operations — read/write a path, replace the record, publish, observe — types
 * itself against this interface and stays compatible with both backing stores.
 *
 * Only the operations a consumer actually calls belong here. The counter
 * specific extras (`increment`, `decrement`, `logs`, `isCounter`, …) stay on
 * `JsonMapBuffer` and are reached by keeping the concrete instance in hand.
 */
import type { FieldInfo, ListPathsOptions } from "./utils/introspect.ts";

export interface BufferHandle<T extends object> {
    /** Unique key used for the shared buffers and local storage. */
    readonly key: string;
    /** Every field with its path, inferred kind, label and current value. */
    listPaths(options: ListPathsOptions): FieldInfo[];
    /** Read one dot/bracket path, e.g. `"players[0].score"`. */
    getPath(path: string): unknown;
    /** Write one path; published by the next `commit()`. */
    setPath(path: string, value: unknown): void;
    /** Swap in a whole new record. */
    replace(next: T): void;
    /** Validate, encode, bump the shared version and notify subscribers. */
    commit(): void;
    /** Called after each `commit()`/`pull()`; returns an unsubscribe fn. */
    subscribe(fn: (state: T) => void): () => void;
}
