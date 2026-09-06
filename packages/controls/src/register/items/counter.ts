import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, tickType, watchPath } from "./common.ts";
import type { CounterOptions } from "../types.ts";

/** A rolling count readout, rendered as a left-dec-padded string label. */
export function registerCounter(
    store: PathStore,
    path: string,
    opts: CounterOptions,
): RegisteredControl {
    const intervalMs = opts.intervalMs ?? 400;
    const digits = opts.digits;
    const signalOutput = opts.signalOutput === true;

    const format = (n: number): string => {
        const s = String(Math.trunc(n));
        return digits == null ? s : s.padStart(digits, "0");
    };

    const initial = Number(store.get(path) ?? 0);
    registerItem(opts, { value: initial, label: format(initial) });

    const refresh = (structure: StructureLike, value: ConfigValue) => {
        const n = typeof value === "number" ? value : Number(value) || 0;
        Structure(structure).setData({ value: n, label: format(n) });
        if (signalOutput) Structure(structure).emitSignalOutput(n !== 0);
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