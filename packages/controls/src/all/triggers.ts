import sandkit from "@sandmd/sandkit";
/** Register repeating callbacks on the main thread via `sandkit.api.triggers`. */
export class TriggerScheduler {
  register(id: string, intervalMs: number, tick: () => void): void {
    const off = sandkit.api.triggers.register(id, {
      intervalMs,
      tick,
      callback: tick,
    });
    if (typeof off === "function") off();
  }
}
