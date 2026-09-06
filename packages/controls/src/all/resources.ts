import { registerBaseStructure } from "./structures.ts";
import type { SignalBus } from "./signal-bus.ts";
import type { StructureLike } from "./types.ts";

export interface ResourceSignalOptions {
  modId: string;
  typeId: string;
  name: string;
  /** Reads the current resource amount each tick. */
  getAmount: () => number;
  /** Minimum amount for the signal to be on. Default 1. */
  threshold?: number;
  intervalMs?: number;
  signalBus?: SignalBus;
  spriteId?: string;
}

/** Register a tile that signals when a resource amount is `>= threshold`. */
export function registerResourceSignalTile(options: ResourceSignalOptions): void {
  const threshold = options.threshold ?? 1;
  const intervalMs = options.intervalMs ?? 200;
  const typeId = options.typeId;

  registerBaseStructure({
    id: typeId,
    name: options.name,
    spriteId: options.spriteId ?? typeId,
    description: `Signal on when resource ≥ ${threshold}`,
    defaultData: { threshold, signal: false },
  });

  const process = (structure: StructureLike) => {
    const amount = options.getAmount();
    const on = amount >= threshold;
    structure.data.signal = on;
    structure.data.amount = amount;
    options.signalBus?.emit(structure, on);
  };

  if (options.signalBus) {
    options.signalBus.registerProcessing(typeId, intervalMs, process);
  } else {
    sandkit.api.structures.processing.register(typeId, { intervalMs, process });
  }
}
