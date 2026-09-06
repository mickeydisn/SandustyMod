/*

/** Minimal `JsonBuffer`-like surface used by worker ticks. * /
export interface WorkerRecord {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  commit(): void;
  sync?(): void;
}

export interface WorkerTickOptions<T extends WorkerRecord = WorkerRecord> {
  record: T;
  /** Runs each tick. Call `record.commit()` when you mutate paths. * /
  run: (record: T) => void;
}

/** Thin per-tick wrapper: syncs main-thread writes, then runs your handler. * /
export class WorkerTick<T extends WorkerRecord = WorkerRecord> {
  readonly record: T;
  private options: WorkerTickOptions<T>;

  constructor(options: WorkerTickOptions<T>) {
    this.options = options;
    this.record = options.record;
  }

  tick(): void {
    this.record.sync?.();
    this.options.run(this.record);
  }
}

*/
