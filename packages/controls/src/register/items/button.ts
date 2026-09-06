import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem } from "./common.ts";
import type { ButtonOptions } from "../types.ts";

/**
 * A clickable action control. Behaviour is chosen with `mode`:
 *  - "pulse":     acts while pressed, then releases after `pulseMs`;
 *  - "set":       writes `pressValue` to the path and stays pressed for `pulseMs`;
 *  - "increment": adds `incrementBy` to the path value on each press.
 */
export function registerButton(
    store: PathStore,
    path: string,
    opts: ButtonOptions,
): RegisteredControl {
    const mode = opts.mode ?? "pulse";
    const pulseMs = opts.pulseMs ?? 100;
    const incrementBy = opts.incrementBy ?? 1;
    const pressValue: ConfigValue = opts.pressValue ?? true;

    registerItem(opts, { pressed: false });

    const releaseVisual = (structure: StructureLike) => {
        Structure(structure).update({ pressed: false });
    };

    const press = (structure: StructureLike) => {
        Structure(structure).update({ pressed: true });
        if (mode === "set") {
            store.set(path, pressValue);
        } else if (mode === "increment") {
            store.set(path, Number(store.get(path) ?? 0) + incrementBy);
        } else {
            store.set(path, true);
            Structure(structure).scheduleMomentary(
                opts.id,
                structure,
                pulseMs,
                () => {
                    store.set(path, false);
                    releaseVisual(structure);
                },
            );
            return;
        }
        Structure(structure).scheduleMomentary(
            opts.id,
            structure,
            pulseMs,
            () => releaseVisual(structure),
        );
    };

    StructureType(opts.id).registerInteractable((structure) => press(structure));
    StructureType(opts.id).registerTarget((structure, payload) => {
        if (payload.combined) press(structure);
    });

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => store.set(path, value),
    );
}