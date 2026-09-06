import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, tickType, watchPath } from "./common.ts";
import type { DisplayOptions } from "../types.ts";

/** A raw value readout; optionally frames a spritesheet via thresholds. */
export function registerDisplay(
    store: PathStore,
    path: string,
    opts: DisplayOptions,
): RegisteredControl {
    registerItem(opts, { value: store.get(path) });

    const mode = opts.mode ?? "data-only";
    const intervalMs = opts.intervalMs ?? 500;
    const thresholds = opts.thresholds ?? [];
    const signalOutput = opts.signalOutput === true;

    const pushVisual = (structure: StructureLike, value: ConfigValue) => {
        Structure(structure).setData({ value });
        if (mode === "spritesheet" && typeof value === "number") {
            if (sandkit.api.structures.setSpritesheetIndexByValue &&
                thresholds.length > 0
            ) {
                sandkit.api.structures.setSpritesheetIndexByValue(
                    structure,
                    value,
                    thresholds,
                );
            } else if (sandkit.api.structures.setSpritesheetIndexAtCell) {
                sandkit.api.structures.setSpritesheetIndexAtCell(
                    structure.x,
                    structure.y,
                    Math.max(0, Math.floor(value)),
                );
            }
        }
        if (signalOutput) {
            Structure(structure).emitSignalOutput(
                Boolean(value) && value !== 0 && value !== "",
            );
        }
    };

    tickType(opts.id, intervalMs, (structure) => {
        const value = store.get(path);
        if (structure.data.value !== value) pushVisual(structure, value);
    });
    watchPath(store, path, opts.id, (structure, value) => pushVisual(structure, value));

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => store.set(path, value),
    );
}