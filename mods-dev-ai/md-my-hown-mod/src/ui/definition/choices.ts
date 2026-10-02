/**
 * The small closed vocabularies the config uses, in one place.
 *
 * Each of these was written out again in three or four spots: the type in
 * constants.ts, the select options in the definition that edits it, and the
 * membership check in the register step that consumes it. Only the type is
 * authoritative — the value list here is checked against it, so adding a
 * member to a type without a label fails `deno check` rather than showing up
 * as a select with no row for it.
 *
 * Labels live here rather than in the definitions so the definition files can
 * read as a list of fields instead of a place where the vocabulary is
 * restated.
 */
import type { BufferValueType, HookKind, UnlockNodeKind } from "../../constants.ts";
import type { Opt } from "../../catalog.ts";

/**
 * The energy roles the editor offers.
 *
 * EnergyRole itself is open to any string, since the engine may accept a role
 * this mod has not heard of, so the two it does offer are named separately.
 */
export type KnownEnergyRole = "conductor" | "storage";

/** Narrow a value list to the type it describes; fails if one is missing. */
function optsFor<T extends string>(values: readonly T[]): Opt[] {
    return values.map((value) => ({ value, label: labelFor(value) }));
}

function labelFor(value: string): string {
    return (LABEL as Record<string, string>)[value] ?? value;
}

/**
 * `satisfies` is what ties each list back to the type in constants.ts. The
 * key set is the union of the four closed vocabularies; EnergyRole itself
 * cannot be used as a key because it stays open to any string, so the two
 * known members are named here.
 */
const LABEL = {
    storage: "storage — holds energy (needs a capacity)",
    conductor: "conductor — forwards energy, holds nothing",

    intercept: "intercept — observe, can cancel",
    modify: "modify — transform the value",

    always: "always — available from the start",
    tech: "tech — a real research step in the game's tech tree",

    number: "number — an integer counter, clamped to min/max",
    bool: "bool — true / false",
    string: "string — free text",
} as const satisfies Record<
    KnownEnergyRole | HookKind | UnlockNodeKind | BufferValueType,
    string
>;

/** A value is one of `values`, narrowed to the union they spell. */
export function isOneOf<T extends string>(values: readonly T[], v: unknown): v is T {
    return typeof v === "string" && (values as readonly string[]).includes(v);
}

export const ENERGY_ROLES = [
    "storage",
    "conductor",
] as const satisfies readonly KnownEnergyRole[];

export const HOOK_KINDS = ["intercept", "modify"] as const satisfies readonly HookKind[];

export const UNLOCK_NODE_KINDS = ["always", "tech"] as const satisfies readonly UnlockNodeKind[];

export const BUFFER_VALUE_TYPES = [
    "number",
    "bool",
    "string",
] as const satisfies readonly BufferValueType[];

export const ENERGY_ROLE_OPTS: Opt[] = optsFor(ENERGY_ROLES);

export const HOOK_KIND_OPTS: Opt[] = optsFor(HOOK_KINDS);

export const UNLOCK_NODE_KIND_OPTS: Opt[] = optsFor(UNLOCK_NODE_KINDS);

export const BUFFER_VALUE_TYPE_OPTS: Opt[] = optsFor(BUFFER_VALUE_TYPES);
