import type { PathStore } from "../../all/store.ts";
import { registerBaseStructure, StructureType } from "../../sandlink/structures.ts";
import type {
    ConfigValue,
    RegisteredControl,
    StructureLike,
    StructureOptions,
} from "../../types.ts";

/**
 * Register a structure definition, layering caller-supplied `opts.defaultData`
 * on top of sensible control defaults (`defaults`).
 */
export function registerItem(
    opts: StructureOptions,
    defaults: Record<string, unknown>,
): void {
    registerBaseStructure({
        ...opts,
        defaultData: { ...defaults, ...(opts.defaultData ?? {}) },
    });
}

/**
 * Re-render every placed structure of `typeId` with `value` whenever `path`
 * changes in the store.
 */
export function watchPath(
    store: PathStore,
    path: string,
    typeId: string,
    refresh: (structure: StructureLike, value: ConfigValue) => void,
): void {
    store.subscribe((changedPath, value) => {
        if (changedPath !== path) return;
        StructureType(typeId).forEachOfType((structure) => refresh(structure, value));
    });
}

/** Poll `process` for every placed structure of `typeId` every `intervalMs` ms. */
export function tickType(
    typeId: string,
    intervalMs: number,
    process: (structure: StructureLike) => void,
): void {
    sandkit.api.structures.processing?.register?.(typeId, { intervalMs, process });
}

/** Build the standard handle returned to control-system callers. */
export function controlHandle(
    structureId: string,
    path: string,
    getValue: () => ConfigValue,
    setValue: (value: ConfigValue) => void,
): RegisteredControl {
    return { structureId, path, setValue, getValue };
}