import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, tickType, watchPath } from "./common.ts";
import { clamp, type GaugeOptions } from "../types.ts";

/** A value display shown at one of `steps` spritesheet frames. */
export function registerGauge(
    store: PathStore,
    path: string,
    opts: GaugeOptions,
): RegisteredControl {
    const min = opts.min ?? 0;
    const max = opts.max ?? 100;
    const steps = Math.max(1, opts.steps ?? 8);
    const intervalMs = opts.intervalMs ?? 400;
    const signalOutput = opts.signalOutput === true;

    const toStep = (value: number): number => {
        if (max === min) return 0;
        return Math.round(clamp((value - min) / (max - min), 0, 1) * (steps - 1));
    };

    const initial = Number(store.get(path) ?? min);
    registerItem(opts, { value: initial, step: toStep(initial) });

    const refresh = (structure: StructureLike, value: ConfigValue) => {
        const n = typeof value === "number" ? value : min;
        const step = toStep(n);
        Structure(structure).setData({ value: n, step });
        if (sandkit.api.structures.setSpritesheetIndex) {
            sandkit.api.structures.setSpritesheetIndex(structure, step);
        }
        if (signalOutput) Structure(structure).emitSignalOutput(step > 0);
    };

    tickType(opts.id, intervalMs, (structure) => refresh(structure, store.get(path)));
    watchPath(store, path, opts.id, (structure, value) => refresh(structure, value));

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => {
            if (typeof value === "number") store.set(path, value);
        },
    );
}