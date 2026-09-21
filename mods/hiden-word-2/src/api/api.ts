import type { ApiSurface } from "../world/types.ts";

declare const sandkit: { api: unknown };

export const api = sandkit.api as unknown as ApiSurface;
