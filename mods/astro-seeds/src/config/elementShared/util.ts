/**
 * Small helpers shared by both builds.
 */
import { MOD_ID } from "../../ids.ts";
import type { AstroElementSpec } from "./types.ts";

/** Build the engine id (`${MOD_ID}:<slug>`) for a catalogue spec. */
export function spec(entry: Omit<AstroElementSpec, "id"> & { slug: string }): AstroElementSpec {
    return { ...entry, id: `${MOD_ID}:${entry.slug}` };
}

/** Run `fn`, swallowing errors into `fallback` (engine api may be absent). */
export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}
