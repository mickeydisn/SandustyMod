import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, watchPath } from "./common.ts";
import type { ToggleOptions } from "../types.ts";

/**
 * A binary on/off switch. Clicking flips `structure.data.on`, which is mirrored
 * into the store (either a fixed `onValue`/`offValue` or, with `accumulate`,
 * a counter that increments/decrements).
 */
export function registerToggle(
    store: PathStore,
    path: string,
    opts: ToggleOptions,
): RegisteredControl {
    registerItem(opts, { on: false });

    const onValue: ConfigValue = opts.onValue ?? true;
    const offValue: ConfigValue = opts.offValue ?? false;

    const applyState = (structure: StructureLike, on: boolean) => {
        Structure(structure).update({ on });
        if (opts.accumulate) {
            store.set(path, Number(store.get(path) ?? 0) + (on ? 1 : -1));
        } else {
            store.set(path, on ? onValue : offValue);
        }
    };

    StructureType(opts.id).registerInteractable((structure) => {
        applyState(structure, !structure.data.on);
    });
    StructureType(opts.id).registerTarget((structure, payload) => {
        applyState(structure, !!payload.combined);
    });

    if (!opts.accumulate) {
        watchPath(store, path, opts.id, (structure, value) => {
            const wantOn = value === onValue || value === true;
            if (structure.data.on !== wantOn) Structure(structure).setData({ on: wantOn });
        });
    }

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => {
            if (opts.accumulate) {
                store.set(path, typeof value === "number" ? value : Number(value) || 0);
                return;
            }
            const on = value === onValue || value === true;
            store.set(path, on ? onValue : offValue);
            StructureType(opts.id).forEachOfType((s) => Structure(s).setData({ on }));
        },
    );
}