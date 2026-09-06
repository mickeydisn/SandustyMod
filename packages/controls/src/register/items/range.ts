import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem, watchPath } from "./common.ts";
import { clamp, type RangeOptions } from "../types.ts";

export function registerRange(
    store: PathStore,
    path: string,
    opts: RangeOptions,
): RegisteredControl {
    const min = opts.min;
    const max = opts.max;
    const step = opts.step ?? 1;

    if (store.get(path) == null) store.set(path, opts.initial ?? min);

    return (opts.layout ?? "single") === "triple"
        ? registerTripleRange(store, path, opts, min, max, step)
        : registerSingleRange(store, path, opts, min, max, step);
}

function registerSingleRange(
    store: PathStore,
    path: string,
    opts: RangeOptions,
    min: number,
    max: number,
    step: number,
): RegisteredControl {
    registerItem(opts, { value: Number(store.get(path) ?? min) });

    const write = (structure: StructureLike, value: number) => {
        const v = clamp(value, min, max);
        Structure(structure).update({ value: v });
        store.set(path, v);
        if (sandkit.api.structures.setSpritesheetIndexByValue) {
            sandkit.api.structures.setSpritesheetIndexByValue(structure, v, [min, max]);
        }
    };

    StructureType(opts.id).registerInteractable((structure) => {
        const cur = Number(structure.data.value ?? store.get(path) ?? min);
        write(structure, cur + step > max ? min : clamp(cur + step, min, max));
    });
    StructureType(opts.id).registerTarget((structure, payload) => {
        if (!payload.combined) return;
        const cur = Number(structure.data.value ?? store.get(path) ?? min);
        write(structure, clamp(cur + step, min, max));
    });

    watchPath(store, path, opts.id, (structure, value) => {
        if (typeof value === "number" && structure.data.value !== value) {
            Structure(structure).setData({ value });
        }
    });

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => {
            if (typeof value !== "number") return;
            const v = clamp(value, min, max);
            store.set(path, v);
            StructureType(opts.id).forEachOfType((s) => Structure(s).setData({ value: v }));
        },
    );
}

function registerTripleRange(
    store: PathStore,
    path: string,
    opts: RangeOptions,
    min: number,
    max: number,
    step: number,
): RegisteredControl {
    const minusId = `${opts.id}-minus`;
    const displayId = `${opts.id}-display`;
    const plusId = `${opts.id}-plus`;
    const common = {
        categoryKey: opts.categoryKey,
        order: opts.order,
        renderSize: opts.renderSize,
        shape: opts.shape ?? [[1]],
        buildModes: opts.buildModes,
    };

    registerItem({ ...common, id: minusId, name: `${opts.name} −`, spriteId: opts.spriteId }, { role: "minus" });
    registerItem({ ...common, id: displayId, name: opts.name, spriteId: opts.spriteId }, { role: "display", value: Number(store.get(path) ?? min) });
    registerItem({ ...common, id: plusId, name: `${opts.name} +`, spriteId: opts.spriteId }, { role: "plus" });

    const bump = (dir: 1 | -1) => {
        const next = clamp(Number(store.get(path) ?? min) + dir * step, min, max);
        store.set(path, next);
        StructureType(displayId).forEachOfType((s) => Structure(s).setData({ value: next }));
    };

    StructureType(minusId).registerInteractable(() => bump(-1));
    StructureType(plusId).registerInteractable(() => bump(1));
    StructureType(minusId).registerTarget((_s, payload) => {
        if (payload.combined) bump(-1);
    });
    StructureType(plusId).registerTarget((_s, payload) => {
        if (payload.combined) bump(1);
    });

    watchPath(store, path, displayId, (structure, value) => {
        if (typeof value === "number") Structure(structure).setData({ value });
    });

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => {
            if (typeof value === "number") store.set(path, clamp(value, min, max));
        },
    );
}