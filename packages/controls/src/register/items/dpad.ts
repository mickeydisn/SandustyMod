import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { RegisteredControl, StructureLike } from "../../types.ts";
import { controlHandle, registerItem } from "./common.ts";
import type { DpadOptions } from "../types.ts";

type Dir = "center" | "n" | "e" | "s" | "w";
const CYCLE: Dir[] = ["center", "n", "e", "s", "w"];
const VEC: Record<Dir, { x: number; y: number }> = {
    center: { x: 0, y: 0 },
    n: { x: 0, y: -1 },
    e: { x: 1, y: 0 },
    s: { x: 0, y: 1 },
    w: { x: -1, y: 0 },
};

/** A 5-direction pad writing an (x, y) vector into two store paths. */
export function registerDpad(
    store: PathStore,
    basePath: string,
    opts: DpadOptions,
): RegisteredControl {
    const pathX = opts.pathX ?? `${basePath}.x`;
    const pathY = opts.pathY ?? `${basePath}.y`;
    const cycleOnClick = opts.cycleOnClick !== false;

    registerItem(opts, { dir: "center" });

    const apply = (structure: StructureLike, dir: Dir) => {
        const v = VEC[dir];
        Structure(structure).update({ dir });
        store.set(pathX, v.x);
        store.set(pathY, v.y);
        if (sandkit.api.structures.setSpritesheetIndex) {
            sandkit.api.structures.setSpritesheetIndex(structure, CYCLE.indexOf(dir));
        }
    };

    StructureType(opts.id).registerInteractable((structure) => {
        if (!cycleOnClick) return;
        const idx = CYCLE.indexOf(String(structure.data.dir ?? "center") as Dir);
        apply(structure, CYCLE[(idx + 1) % CYCLE.length]!);
    });
    StructureType(opts.id).registerTarget((structure, payload) => {
        apply(structure, payload.combined ? "n" : "center");
    });

    const dirFor = (x: number, y: number): Dir => {
        for (const [dir, v] of Object.entries(VEC)) {
            if (v.x === x && v.y === y) return dir as Dir;
        }
        return "center";
    };

    return controlHandle(
        opts.id,
        basePath,
        () => dirFor(Number(store.get(pathX) ?? 0), Number(store.get(pathY) ?? 0)),
        (value) => {
            if (typeof value === "string" && value in VEC) {
                StructureType(opts.id).forEachOfType((s) => apply(s, value as Dir));
            }
        },
    );
}