import "@sandmd/sandkit";
import {
    buildStructureDefinition,
    type StructureOptions as CatalogueStructureOptions,
} from "@sandmd/catalogue";
import type { SignalPayload, StructureLike, StructureOptions } from "../types.ts";

const registeredMomentary = new Set<string>();
const releases = new WeakMap<object, () => void>();

export function registerBaseStructure(opts: StructureOptions): void {
    sandkit.api.structures.register(buildStructureDefinition(toCatalogue(opts)));
}

/**
 * Adapt the public, flatter options into the nested shape that
 * `@sandmd/catalogue`'s `buildStructureDefinition` expects.
 */
function toCatalogue(opts: StructureOptions): CatalogueStructureOptions {
    const renderSize = opts.renderSize ?? { width: 16, height: 16 };
    return {
        id: opts.id,
        name: opts.name,
        spriteId: opts.spriteId,
        renderSize,
        def: {
            nameKey: opts.nameKey,
            description: opts.description,
            categoryKey: opts.categoryKey,
            order: opts.order,
            shape: opts.shape,
            buildModes: opts.buildModes,
        },
        defaultData: opts.defaultData,
        activeOnPlace: opts.activeOnPlace,
        cells: opts.cells,
    };
}

export const StructureType = (sType: string) => ({
    forEachOfType(
        cb: (structure: StructureLike) => void,
    ): void {
        sandkit.api.structures.forEachOfType(sType, cb);
    },

    registerInteractable(
        handler: (struct: StructureLike) => void,
    ): void {
        sandkit.api.signals?.interactables?.register(sType, handler);
    },

    registerTarget(
        handler: (struct: StructureLike, payload: SignalPayload) => void,
    ): void {
        sandkit.api.signals?.targets?.register(sType, handler);
    },
});

export const Structure = (struct: StructureLike) => ({
    register(opts: StructureOptions): void {
        registerBaseStructure(opts);
    },

    typeOf(): string {
        return String(struct.type ?? struct.structureType ?? "");
    },

    update(
        partial?: Record<string, unknown>,
    ): void {
        if (partial) Object.assign(struct.data, partial);
        sandkit.api.structures.update(struct, { propagateToWorkers: true });
    },

    setData(
        partial: Record<string, unknown>,
    ): void {
        sandkit.api.structures.setData(struct, partial, {
            propagateToWorkers: true,
        });
    },

    /** Drive sandkit signal output from `structure.data.signal`. */
    emitSignalOutput(on: boolean): void {
        struct.data.signal = on;
        sandkit.api.signals?.sources?.set?.(struct, on);
    },

    /**
     * Release a pressed/pulsed state after `untilMs` via `structures.processing`
     * (no `setTimeout`, so it stays in the game tick loop).
     */
    scheduleMomentary(
        typeId: string,
        structure: StructureLike,
        untilMs: number,
        onRelease: () => void,
        intervalMs = 50,
    ): void {
        releases.set(struct, onRelease);
        structure.data._momentaryUntil = Date.now() + untilMs;

        if (!sandkit.api.structures.processing?.register) {
            onRelease();
            releases.delete(struct);
            return;
        }
        if (registeredMomentary.has(typeId)) return;
        registeredMomentary.add(typeId);

        sandkit.api.structures.processing.register(`${typeId}:momentary`, {
            intervalMs,
            process: () => {
                StructureType(typeId).forEachOfType((s) => {
                    const until = Number(s.data._momentaryUntil ?? 0);
                    if (!until || Date.now() < until) return;
                    s.data._momentaryUntil = 0;
                    releases.get(s)?.();
                    releases.delete(s);
                });
            },
        });
    },
});
