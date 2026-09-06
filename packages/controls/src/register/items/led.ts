import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { ConfigValue, RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, tickType, watchPath } from "./common.ts";
import type { LedOptions } from "../types.ts";

/** A light that turns on when the stored value matches `onWhen`. */
export function registerLed(
    store: PathStore,
    path: string,
    opts: LedOptions,
): RegisteredControl {
    const onWhen: ConfigValue = opts.onWhen ?? true;
    const intervalMs = opts.intervalMs ?? 400;
    const signalOutput = opts.signalOutput !== false;

    registerItem(opts, {
        on: store.get(path) === onWhen || store.get(path) === true,
    });

    const refresh = (structure: StructureLike, value: ConfigValue) => {
        const on = value === onWhen || value === true;
        if (structure.data.on === on) return;
        Structure(structure).setData({ on });
        if (sandkit.api.structures.setSpritesheetIndex) {
            sandkit.api.structures.setSpritesheetIndex(structure, on ? 1 : 0);
        }
        if (signalOutput) Structure(structure).emitSignalOutput(on);
    };

    tickType(opts.id, intervalMs, (structure) => refresh(structure, store.get(path)));
    watchPath(store, path, opts.id, (structure, value) => refresh(structure, value));

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => store.set(path, value),
    );
}