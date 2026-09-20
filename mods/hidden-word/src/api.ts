/**
 * Hidden World — typed handle on the sandkit API plus small shared helpers.
 */

import "@sandmd/sandkit";
import type { ApiSurface } from "./types.ts";

/** The host `sandkit.api`, widened to everything this mod uses. */
export const api = sandkit.api as unknown as ApiSurface;
