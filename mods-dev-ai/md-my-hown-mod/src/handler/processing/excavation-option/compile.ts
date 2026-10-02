import { resolveExcavationOption } from "./registry.ts";
import type {
    ExcavationOptionFailure,
    ExcavationOptionPatch,
    ExcavationOptionRef,
} from "./types.ts";

export const EXCAVATION_OPTION_STORE_KEY = "option";

export interface CompiledExcavationOption {
    patch: ExcavationOptionPatch;

    key?: string;

    problem?: string;
}

export function excavationOptionOf(
    entry: Record<string, unknown> | undefined,
): { ref?: ExcavationOptionRef; problem?: string } {
    if (!entry) return {};
    const stored = entry[EXCAVATION_OPTION_STORE_KEY];
    if (
        stored && typeof stored === "object" &&
        typeof (stored as ExcavationOptionRef).key === "string"
    ) {
        return {
            ref: {
                key: String((stored as ExcavationOptionRef).key),
                params: (stored as ExcavationOptionRef).params ?? undefined,
            },
        };
    }
    return {};
}

export function compileExcavationProfile(
    entry: Record<string, unknown> | undefined,
    onFailure?: (f: ExcavationOptionFailure) => void,
): CompiledExcavationOption {
    const { ref, problem: foundProblem } = excavationOptionOf(entry);
    if (!ref?.key) return { patch: fromEntry(entry) };

    const fn = resolveExcavationOption(ref.key);
    if (!fn) {
        const problem = foundProblem ?? `not an excavation option: ${ref.key}`;
        onFailure?.({ key: ref.key, error: new Error(problem) });

        return { patch: fromEntry(entry), key: ref.key, problem };
    }

    try {
        const built = fn(ref.params);
        const patch: ExcavationOptionPatch = {};
        if (typeof built.power === "number") patch.power = built.power;
        if (built.options && Object.keys(built.options).length > 0) {
            patch.options = { ...built.options };
        }
        return { patch, key: ref.key };
    } catch (error) {
        onFailure?.({ key: ref.key, error });
        return { patch: fromEntry(entry), key: ref.key, problem: String(error) };
    }
}

function fromEntry(entry: Record<string, unknown> | undefined): ExcavationOptionPatch {
    const patch: ExcavationOptionPatch = {};
    if (entry && typeof entry.power === "number") patch.power = entry.power;
    if (entry?.options && typeof entry.options === "object") {
        patch.options = { ...(entry.options as Record<string, unknown>) };
    }
    return patch;
}
