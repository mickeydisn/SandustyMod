/**
 * Small helpers used while describing an element catalogue entry.
 */
import { MOD_ID } from "./ids.ts";
import type { AstroElementSpec } from "../element/types.ts";

/** Build the engine id (`${MOD_ID}:<slug>`) for a catalogue spec. */
export function spec(entry: Omit<AstroElementSpec, "id"> & { slug: string }): AstroElementSpec {
    return { ...entry, id: `${MOD_ID}:${entry.slug}` };
}
