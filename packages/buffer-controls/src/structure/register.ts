/**
 * registerStructures — the single registration pass for every catalogue item.
 *
 * One loop walks the whole build list once and dispatches each item to the
 * per-category register modules in `./register/`. Each module decides, from the
 * item's category/tags/kind, whether it owns that item and, if it does, calls
 * `sandkit.api.structures.register` (and wires signals) for it. The modules
 * hand back the runtime handles they need to stay alive and this aggregator
 * merges them into one result:
 *   - `refreshSignals` — recompute + push every placed action structure's
 *     signal output (event-driven, called on each buffer commit).
 *   - `valueEntries`   — every typeId / path / kind of placed value structure,
 *     used to keep the live readouts in sync with the buffer.
 */
import "@sandmd/sandkit";

import type { BuildList, CatalogueItem } from "@sandmd/catalogue";
import type { JsonBuffer } from "@sandmd/buffer";
import {
    type ActionCatalogueItem,
    type ActionRead,
    type ActionRegisterResult,
    type ActionWrite,
} from "./register/actionRegister.ts";
import type { PathCatalogueItem } from "./shared.ts";
import { registerMenuStructures } from "./register/menuRegister.ts";
import { registerPathStructures } from "./register/varRegister.ts";
import { registerValueStructures, type ValueStructureEntry } from "./register/valueRegister.ts";
import { registerActionNumberStructures } from "./register/actionNumberRegister.ts";
import { registerBooleanActionStructures } from "./register/actionBooleanRegister.ts";

/** Recompute + push every placed action structure's signal output (from ./register/actionRegister.ts). */
export type { ActionRegisterResult } from "./register/actionRegister.ts";

/** Everything the per-category register modules need to build one structure. */
export type registerStructureOps = {
    typeId: string;
    item: ActionCatalogueItem;
    spriteFor: (item: CatalogueItem) => string | undefined;
    read: ActionRead;
    write: ActionWrite;
};

/** Extended result: also exposes the live value structures for readout sync. */
export interface StructureRegisterResult extends ActionRegisterResult {
    valueEntries: ValueStructureEntry[];
}

export function registerStructures<T extends object>(
    buffer: JsonBuffer<T>,
    list: BuildList,
    spriteFor: (item: CatalogueItem) => string | undefined,
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
    for (const item of list.catalogueItems as PathCatalogueItem[]) {
        const ops: registerStructureOps = {
            // Structure type id is the catalogue-prefixed type (`modId:item/<id>`),
            // which is what list.structureType / picker select / unlock all use.
            typeId: list.structureType(item.id),
            item,
            spriteFor,
            read: readBuffer,
            write: writeBuffer,
        };

        registerMenuStructures(ops);
        registerPathStructures(ops);

        const value = registerValueStructures(ops);
        if (value) valueEntries.push(...value.entries);

        // Number + boolean action senders each supply a refreshSignals that
        // recomputes their own placed structures; merge them all into one.
        const number = registerActionNumberStructures(ops);
        if (number) refreshers.push(number.refreshSignals);
        const boolean = registerBooleanActionStructures(ops);
        if (boolean) refreshers.push(boolean.refreshSignals);
    }

    console.log(
        `[${list.modId}] registered structures (${valueEntries.length} value types, ${refreshers.length} action registers)`,
    );

    return {
        valueEntries,
        refreshSignals: () => {
            for (const refresh of refreshers) refresh();
        },
    };
}
