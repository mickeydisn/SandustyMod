import type { FieldKind } from "./types.ts";

/** Pixels per world cell and one-cell structure footprint. */
export const CELL = 16;

/** Kinds that produce a placeable structure (arrays/objects excluded for now). */
export const EXPOSED_KINDS: FieldKind[] = ["bool", "number", "string"];
