import type { PathStore } from "../../all/store.ts";
import { Structure, StructureType } from "../../sandlink/structures.ts";
import type { RegisteredControl } from "../../types.ts";
import { controlHandle, registerItem, watchPath } from "./common.ts";
import type { TextOptions } from "../types.ts";

/** A tile that stores a short string. Clicking opens a text prompt. */
export function registerText(
    store: PathStore,
    path: string,
    opts: TextOptions,
): RegisteredControl {
    registerItem(opts, { text: String(store.get(path) ?? "") });

    const applyText = (text: string) => {
        store.set(path, text);
        StructureType(opts.id).forEachOfType((s) => Structure(s).setData({ text }));
    };

    StructureType(opts.id).registerInteractable((structure) => {
        const current = String(store.get(path) ?? structure.data.text ?? "");
        if (sandkit.api.ui?.prompt) {
            sandkit.api.ui.prompt(
                {
                    title: opts.promptTitle ?? opts.name,
                    message: opts.promptMessage ?? "Enter value",
                    defaultValue: current,
                },
                (value) => {
                    if (value != null) applyText(value);
                },
            );
        } else {
            applyText(current ? "" : "set");
        }
    });

    watchPath(store, path, opts.id, (structure, value) => {
        Structure(structure).setData({ text: value == null ? "" : String(value) });
    });

    return controlHandle(
        opts.id,
        path,
        () => store.get(path),
        (value) => applyText(value == null ? "" : String(value)),
    );
}