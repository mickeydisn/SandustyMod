import type { ConfigValue } from "../types.ts";

export type PathListener = (path: string, value: ConfigValue) => void;

/** Minimal path mirror read/write surface (e.g. a `JsonBuffer`). */
export interface PathRecord {
  getPath(path: string): unknown;
  setPath(path: string, value: unknown): void;
  commit(): void;
}

/**
 * Wraps a `JsonBuffer`-like record into a simple typed get/set/subscribe store
 * used by every control. Notifies its listeners on each local `set`.
 */
export class PathStore {
  readonly record: PathRecord;
  private listeners = new Set<PathListener>();

  constructor(record: PathRecord) {
    this.record = record;
  }

  get(path: string): ConfigValue {
    const v = this.record.getPath(path);
    return typeof v === "boolean" || typeof v === "number" ||
        typeof v === "string" || v === null
      ? v
      : null;
  }

  set(path: string, value: ConfigValue): void {
    this.record.setPath(path, value);
    this.record.commit();
    for (const fn of this.listeners) fn(path, value);
  }

  subscribe(listener: PathListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function pathStoreFromRecord(record: PathRecord): PathStore {
  return new PathStore(record);
}
