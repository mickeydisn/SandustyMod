/** Params overlay — intentionally empty (no hotbar status banner). */

import { LOG, OVERLAY_ID } from "../world/constants.ts";
import { api } from "../api/api.ts";

export function registerParamsOverlay(): void {
  try {
    // Register a no-op so older builds that expect the overlay id do not error.
    api.ui.overlays.register("hotbar", OVERLAY_ID, () => null);
  } catch (err) {
    console.warn(`${LOG} overlay register skipped`, err);
  }
}
