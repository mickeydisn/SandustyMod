import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, watchPath } from "./common.ts";
import type { ControlRegistry } from "../registry.ts";
import type { SelectorOptions } from "../types.ts";

/**
 * A one-of-many picker. Clicking cycles the active option (mirrored into the
 * store as the selected label). With `exclusive` (default), only one placed
 * selector instance can be active for the path at a time.
 */
export function registerSelector(
    store: PathStore,
    registry: ControlRegistry,
    path: string,
    opts: SelectorOptions,
): RegisteredControl {
    const options = opts.options;
    if (!options.length) {
        throw new Error(`Selector ${opts.id}: options array must not be empty`);
    }

    const exclusive = opts.exclusive !== false;
    const cycleOnClick = opts.cycleOnClick !== false;

    const current = store.get(path);
    const initialIndex = typeof current === "string"
        ? Math.max(0, options.indexOf(current))
        : 0;

    registerItem(opts, {
        index: initialIndex,
        active: false,
        label: options[initialIndex]!,
    });

    const applyOption = (
        structure: StructureLike,
        index: number,
        makeActive: boolean,
    ) => {
        const clamped = ((index % options.length) + options.length) % options.length;
        const label = options[clamped]!;

        if (makeActive && exclusive) {
            StructureType(opts.id).forEachOfType((other) => {
                if ((other.x !== structure.x || other.y !== structure.y) &&
                    other.data.active
                ) {
                    Structure(other).setData({ active: false });
                }
            });
            registry.claimExclusive(path, structure);
        }

        Structure(structure).setData({
            index: clamped,
            label,
            active: makeActive || structure.data.active,
        });

        if (structure.data.active || !exclusive) store.set(path, label);
        if (sandkit.api.structures.setSpritesheetIndex) {
            sandkit.api.structures.setSpritesheetIndex(structure, clamped);
        }
    };

    StructureType(opts.id).registerInteractable((structure) => {
        const next = Number(structure.data.index) || 0;
        applyOption(structure, cycleOnClick ? next + 1 : next, true);
    });
    StructureType(opts.id).registerTarget((structure, payload) => {
        if (payload.combined) {
            applyOption(structure, Number(structure.data.index) || 0, true);
        } else if (exclusive && registry.isExclusiveOwner(path, structure)) {
            Structure(structure).update({ active: false });
            registry.clearExclusive(path);
        }
    });

    watchPath(store, path, opts.id, (structure, value) => {
        if (typeof value !== "string") return;
        const idx = options.indexOf(value);
        if (idx < 0) return;
        if (sandkit.api.structures.setSpritesheetIndex &&
            (structure.data.active || !exclusive)
        ) {
            Structure(structure).setData({ index: idx, label: value });
            sandkit.api.structures.setSpritesheetIndex!(structure, idx);
        }
    });

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => {
            if (typeof value !== "string") return;
            const idx = options.indexOf(value);
            if (idx < 0) return;
            store.set(path, value);
            StructureType(opts.id).forEachOfType((s) => applyOption(s, idx, true));
        },
    );
}