import { registerInteractable, registerTarget } from "./structures.ts";
import type { SignalPayload, StructureLike } from "./types.ts";

export type SignalHandler = (structure: StructureLike, payload: SignalPayload) => void;

export interface SourceRegistration {
  typeId: string;
  readOn: (structure: StructureLike) => boolean;
  intervalMs?: number;
  pollLinks?: boolean;
}

/**
 * Wires in-game signal sources/targets to your own callbacks, using
 * `sandkit.api.signals` and `sandkit.api.structures.processing` directly.
 */
export class SignalBus {
  private interactHandlers = new Map<string, Set<SignalHandler>>();
  private pulseHandlers = new Map<string, Set<SignalHandler>>();
  private registeredInteract = new Set<string>();
  private registeredPulse = new Set<string>();

  private addHandlers(
    map: Map<string, Set<SignalHandler>>,
    typeId: string,
    handler: SignalHandler,
  ): () => void {
    let set = map.get(typeId);
    if (!set) {
      set = new Set();
      map.set(typeId, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  private fire(
    map: Map<string, Set<SignalHandler>>,
    typeId: string,
    structure: StructureLike,
    payload: SignalPayload,
  ): void {
    for (const h of map.get(typeId) ?? []) {
      try {
        h(structure, payload);
      } catch (err) {
        console.error("[signal-bus] handler", typeId, err);
      }
    }
  }

  /** Register a hook for click / interact events on a structure type. */
  onInteract(typeId: string, handler: SignalHandler): () => void {
    if (!this.registeredInteract.has(typeId)) {
      this.registeredInteract.add(typeId);
      registerInteractable(typeId, (structure) => {
        this.fire(this.interactHandlers, typeId, structure, { combined: true, source: structure });
      });
    }
    return this.addHandlers(this.interactHandlers, typeId, handler);
  }

  /** Register a hook for signal-target pulses on a structure type. */
  onPulse(typeId: string, handler: SignalHandler): () => void {
    if (!this.registeredPulse.has(typeId)) {
      this.registeredPulse.add(typeId);
      registerTarget(typeId, (structure, payload) => {
        this.fire(this.pulseHandlers, typeId, structure, payload ?? {});
      });
    }
    return this.addHandlers(this.pulseHandlers, typeId, handler);
  }

  /** Push a boolean on/off onto a structure's signal source. */
  emit(structure: StructureLike, on: boolean): void {
    structure.data.signal = on;
    sandkit.api.signals?.sources?.set?.(structure, on);
  }

  /** Register a ticking signal source (processing → readOn → emit). */
  registerSource(reg: SourceRegistration): void {
    const poll = reg.pollLinks !== false;
    this.wireOutput(
      reg.typeId,
      (structure) => {
        if (poll) sandkit.api.signals?.links?.poll?.(structure);
        return reg.readOn(structure);
      },
      reg.intervalMs,
    );
  }

  /** Register a repeating processor on a structure type. */
  registerProcessing(typeId: string, intervalMs: number, tick: (s: StructureLike) => void): void {
    sandkit.api.structures.processing.register(typeId, { intervalMs, process: tick });
  }

  /** Each interval, read a boolean from the structure and emit it as its signal. */
  wireOutput(typeId: string, readOn: (s: StructureLike) => boolean, intervalMs = 120): void {
    this.registerProcessing(typeId, intervalMs, (structure) => {
      this.emit(structure, readOn(structure));
    });
  }

  wireAndGate(
    typeId: string,
    reads: Array<(s: StructureLike) => boolean>,
    intervalMs = 120,
  ): void {
    this.wireOutput(typeId, andSignals(...reads), intervalMs);
  }

  wireOrGate(typeId: string, reads: Array<(s: StructureLike) => boolean>, intervalMs = 120): void {
    this.wireOutput(typeId, orSignals(...reads), intervalMs);
  }

  wireNotGate(typeId: string, read: (s: StructureLike) => boolean, intervalMs = 120): void {
    this.wireOutput(typeId, (s) => !read(s), intervalMs);
  }
}

/** Combine multiple `readOn` predicates with AND. */
export function andSignals(
  ...fns: Array<(s: StructureLike) => boolean>
): (s: StructureLike) => boolean {
  return (s) => fns.every((fn) => fn(s));
}

/** Combine multiple `readOn` predicates with OR. */
export function orSignals(
  ...fns: Array<(s: StructureLike) => boolean>
): (s: StructureLike) => boolean {
  return (s) => fns.some((fn) => fn(s));
}
