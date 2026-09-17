/**
 * Key → numeric element-type resolution for worker profiles.
 *
 * Profiles are written against catalogue keys (readable, refactor-safe); this
 * module is the only place that turns them into the numbers the `Move`/`Grow`
 * actions expect. It is worker-only: it reads live element definitions to
 * expand the special `"structure"` key, which the main thread never needs.
 *
 * Special keys (usable anywhere a match key is expected):
 * - `"empty"` → 0. Never appears in a `matchTypes` list — channels express it
 *   via `matchEmpty: true` instead (see `channelMatch`).
 * - `"structure"` → every registered element whose definition is
 *   `MatterType.Static` (crystals, seeds, structures). Element type ids and
 *   matter types are DIFFERENT namespaces — comparing a cell's type against
 *   `MatterType.Static` itself would match whatever element happens to own that
 *   numeric id, so the set is resolved via `getDefinitionByType`.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/shared";
import { MatterType } from "@sandmd/shared";
import type { TElementKey } from "../elementShared/keys.ts";
import { ElementType } from "../elementShared/resolve.ts";

/** A match key: a catalogue key plus the two virtual keys. */
export type TMatchKey = TElementKey | "empty" | "structure";

let structureTypes: Set<number> | null = null;

/**
 * Every registered `MatterType.Static` element type. Computed once, lazily, on
 * first use in the worker (all elements are registered by then).
 */
export function structureTypeSet(): Set<number> {
    if (structureTypes !== null) return structureTypes;
    structureTypes = new Set<number>();
    try {
        const getDef = sandkit.api.elements.getDefinitionByType;
        if (getDef) {
            for (const t of Object.values(ElementType)) {
                if (t == null || t === 0) continue;
                const def = getDef.call(sandkit.api.elements, t);
                if (def && def.matterType === MatterType.Static) structureTypes.add(t);
            }
        }
    } catch {
        /* leave empty — structure cells simply never match */
    }
    return structureTypes;
}

/** One key → numeric type. `"empty"` → 0; `"structure"` is not a single type. */
export function typeOf(key: TMatchKey): TElementType {
    if (key === "empty") return 0;
    if (key === "structure") return 0;
    return ElementType[key] ?? 0;
}

/** A key list → numeric types. `"empty"` is skipped (use `channelMatch`). */
export function typesOf(keys: readonly TMatchKey[]): number[] {
    const out: number[] = [];
    for (const k of keys) {
        if (k === "empty") continue;
        if (k === "structure") {
            for (const t of structureTypeSet()) out.push(t);
        } else {
            out.push(ElementType[k]);
        }
    }
    return out;
}

/** Key list → `Move.channel` match options, honouring `"empty"`. */
export function channelMatch(
    keys: readonly TMatchKey[],
): { matchTypes: number[]; matchEmpty?: boolean } {
    return {
        matchTypes: typesOf(keys),
        matchEmpty: keys.includes("empty") || undefined,
    };
}
