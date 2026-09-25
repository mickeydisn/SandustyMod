import type { FieldKind } from "./types.ts";

/** Pixels per world cell. */
export const CELL = 16;
/** Height of a one-cell structure footprint. */
export const STRUCT_H = 16;

/** Kinds that produce a placeable structure (arrays/objects excluded for now). */
export const EXPOSED_KINDS: FieldKind[] = ["bool", "number", "string"];
