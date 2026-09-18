import { FieldKind } from "./types.ts";

/** Kinds that produce a placeable structure (arrays/objects excluded for now). */
export const EXPOSED_KINDS: FieldKind[] = ["bool", "number", "string"];
