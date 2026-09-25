/**
 * registerStructures — the single registration pass for every catalogue item.
 *
 * One loop walks the whole build list once and routes each item to the
 * register module that owns its declared category/tags/kind.
 *   - `refreshSignals` — recompute + push every placed action structure's
 *     signal output (event-driven, called on each buffer commit).
 *   - `valueEntries`   — every typeId / path / kind of placed value structure,
 *     used to keep the live readouts in sync with the buffer.
 */
import "@sandmd/sandkit";

import type { BuildList } from "@sandmd/catalogue";
import type { BufferHandle } from "@sandmd/buffer";
import type { ActionRead, ActionWrite } from "./register/actionRegister.ts";
import type { ActionOp, PathCatalogueItem } from "../types.ts";
import { registerMenuStructures } from "./register/menuRegister.ts";
import { registerPathStructures } from "./register/varRegister.ts";
import { registerValueStructures, type ValueStructureEntry } from "./register/valueRegister.ts";
import { registerActionNumberStructures } from "./register/actionNumberRegister.ts";
import { registerActionToggleNumberStructures } from "./register/actionToggleNumberRegister.ts";
import { registerBooleanActionStructures } from "./register/actionBooleanRegister.ts";

/** Everything the per-category register modules need to build one structure. */
type StructureCatalogueItem = PathCatalogueItem & {
    action?: ActionOp;
    frames?: number;
};

export type registerStructureOps = {
    typeId: string;
    item: StructureCatalogueItem;
    read: ActionRead;
    write: ActionWrite;
};

export interface StructureRegisterResult {
    refreshSignals: () => void;
    valueEntries: ValueStructureEntry[];
}

export function registerStructures<T extends object>(
    buffer: BufferHandle<T>,
    list: BuildList,
): StructureRegisterResult {
    const readBuffer = (path: string): unknown => buffer.getPath(path);
    const writeBuffer = (path: string, value: unknown): void => {
        buffer.setPath(path, value);
        buffer.commit(); // encode + bump version + notify subscribers
    };

    const refreshers: (() => void)[] = [];
    const valueEntries: ValueStructureEntry[] = [];

    // The one loop — every structure in the mod is registered from here by
    // delegating each catalogue item to the module that owns its category.
    for (const item of list.catalogueItems as StructureCatalogueItem[]) {
        const ops: registerStructureOps = {
            // Structure type id is the catalogue-prefixed type (`modId:item/<id>`),
            // which is what list.structureType / picker select / unlock all use.
            typeId: list.structureType(item.id),
            item,
            read: readBuffer,
            write: writeBuffer,
        };

        if (item.category === "menu") {
            registerMenuStructures(ops);
            continue;
        }

        if (item.tags.includes("variables")) {
            registerPathStructures(ops);
        }
        if (item.tags.includes("value")) {
            valueEntries.push(registerValueStructures(ops));
        }
        // Number, sign-toggle and boolean action senders each supply a
        // refreshSignals that recomputes their own placed structures; merge
        // them all into one.
        if (item.tags.includes("action") && item.kind === "number") {
            const refresher = item.action === "toggleNum" || item.action === "toggleRate"
                ? registerActionToggleNumberStructures(ops)
                : registerActionNumberStructures(ops);
            if (refresher) refreshers.push(refresher);
        }
        if (item.tags.includes("action") && item.kind === "bool") {
            const refresher = registerBooleanActionStructures(ops);
            if (refresher) refreshers.push(refresher);
        }
    }

    return {
        valueEntries,
        refreshSignals: () => {
            for (const refresh of refreshers) refresh();
        },
    };
}
