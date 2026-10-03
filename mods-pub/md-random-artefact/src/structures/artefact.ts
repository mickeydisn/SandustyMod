/**
 * Artefact — not player-placeable, and not player-removable. Emits elements
 * then removes itself.
 *
 * Removal protection is the engine's own `disallowSelection` + `disallowPick`
 * definition flags (see the register call). No hook is used — see the note at
 * the "NEVER unlock" comment for why `building:clearShape` cannot do this.
 *
 * Important: defaultData.remaining starts at 0. Spawn writes real data via
 * updateData and/or the pending map. We must NOT remove until the structure
 * has been bootstrapped (ready === 1) and remaining then hits 0.
 */
import "@sandmd/sandkit";
import type { JsonMapBuffer } from "@sandmd/buffer";
import {
    ARTEFACT_COUNT_MIN,
    ARTEFACT_EMIT_PER_TICK,
    ARTEFACT_ID,
    ARTEFACT_INTERVAL_MS,
    CATEGORY_KEY,
    LOG,
    type ArtefactProgress,
} from "../constants.ts";
import {
    isCellEmpty,
    resolveElementType,
} from "../utils/elements.ts";
import {
    createArtefactSpiralDraw,
    forgetSpiralCounter,
    peekSpiralCounter,
    spawnEmittedElement,
} from "../utils/artefactSpiral.ts";
import { takePendingArtefact } from "../utils/pendingArtefacts.ts";

interface StructurePos {
    x: number;
    y: number;
    data?: Record<string, unknown>;
    type?: string | number;
}

/** Adjacent cells only (structure occupies center). */
function* neighbors(sx: number, sy: number): Generator<{ x: number; y: number }> {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            yield { x: sx + dx, y: sy + dy };
        }
    }
}

export function registerArtefact(
    spriteId: string,
    map: JsonMapBuffer<ArtefactProgress>,
): void {
    const api = sandkit.api;

    api.structures.register(
        {
            id: ARTEFACT_ID,
            name: "Random Artefact",
            description:
                "Mysterious structure that slowly produces a random element type, then vanishes.",
            categoryKey: CATEGORY_KEY,
            order: 99,
            // Keeps it out of the build menu.
            //
            // The build window reads `store.player.buildings` directly
            // (bundel 151647) and does NOT consult `alwaysUnlocked` — that
            // flag is only read while walking `Ue`, the `const` literal of
            // vanilla structures (bundel 3268), which a mod id never enters.
            // So this flag is inert either way; what actually keeps the
            // artefact hidden is that nothing ever calls `unlockInBuildMenu`
            // for this id, so it is never pushed into `player.buildings`.
            alwaysUnlocked: false,
            /**
             * Engine-native guards. Two separate flags are read by the engine
             * and they are NOT interchangeable:
             *
             *  - `disallowSelection` — the marquee/grabber layer. It is honoured
             *    in the removal filter only when the caller passes
             *    `preserveUnselectable`, which every player clear/move/cut does
             *    (verified in the shipped bundle: the marquee-clear and
             *    selection-cut call sites both pass it). It also keeps the
             *    structure out of the grabber's selection set, so it cannot be
             *    moved or copied.
             *
             *  - `disallowPick` — the "Pick Block" shortcut layer. That path
             *    checks ONLY this flag and never looks at `disallowSelection`,
             *    so without it the player could pick the artefact off the map.
             *    Vanilla uses the pair together for exactly this reason
             *    (powerBrick, recall_shard).
             *
             * Our own `removeAtCell` intentionally passes neither option, so
             * the artefact can still delete itself once production ends.
             */
            disallowSelection: true,
            disallowPick: true,
            shape: [[0]],
            copyData: true,
            /**
             * Cartoon spiral aura. The engine lifts `draw` out of the definition
             * before storing it (so the stored definition stays serializable)
             * and calls it each frame with `(state, structure, render)`.
             *
             * It returns `false` on purpose: that keeps the engine's normal
             * sprite rendering, and only adds the aura on top.
             */
            draw: createArtefactSpiralDraw(),
            buildModes: [{ type: "single" }],
            defaultData: {
                elementType: "sand",
                remaining: 0,
                total: 0,
                progress: 0,
                max: 0,
                status: "booting",
                /** 0 = waiting for spawn data, 1 = producing */
                ready: 0,
            },
            render: {
                imageName: spriteId,
                size: { width: 16, height: 16 },
                offset: { x: 0, y: 0 },
                ui: { outline: true, imageName: spriteId },
            },
            // Deliberately NO `tooltipHover`.
            //
            // The grabber's hover inspector (bundel 50348) checks only
            // `definition.tooltipHover.type === "custom"` and then calls the
            // renderer unconditionally — there is no hook and no flag to veto
            // it, so the only way to stay silent is to not define one.
            // (`interactable:suppressHover` does not apply: it only guards
            // structures that registered an interactable handler.)
            //
            // With it absent the grabber falls through to the element /
            // terrain / damaged-terrain branches. The artefact occupies one
            // Empty or Block cell, and neither is a key in the cell-type
            // table, so those branches all fail and nothing is drawn.
        },
        // `useRawShape` is an *option of register()*, not a definition field.
        // Inside the object it is silently ignored and the shape gets
        // remapped (1 → Block, anything else → Empty).
        { useRawShape: true },
    );

    // NEVER unlock — the player must not place / pick this from the build menu.
    // Only the generator places it via buildAtCell.
    //
    // No hook is registered for removal protection, and
    // `hooks.intercept("building:clearShape", …)` cannot do this job — it was
    // tried and verified dead in the shipped bundle:
    //
    //   const def = getDefinition(t.type);
    //   if (def.dynamicShape && runInterceptorsSafe(e,"building:clearShape",…)) return;
    //
    // Two independent reasons it cannot help:
    //   1. it is gated on `dynamicShape`, which this definition does not set,
    //      so the hook is never even invoked for the artefact (confirmed live:
    //      a registered interceptor never fired);
    //   2. that routine only clears *terrain* matching the shape — it never
    //      removes the structure at all.
    //
    // The guard is the engine's own `disallowSelection` + `disallowPick` flags
    // on the definition above.

    const structureType =
        api.structures.getTypeFromId?.(ARTEFACT_ID) ??
        api.structures.getTypeById?.(ARTEFACT_ID) ??
        ARTEFACT_ID;

    // Drop the live counter from the removal event, not from here.
    //
    // `removeAtCell` only *requests* a removal, and the engine may drop it
    // (e.g. the cell already emptied), so decrementing at call time can drift.
    // `structures:removed` is the authoritative signal and also covers the one
    // path `disallowSelection` cannot stop — the Demolisher tool, which calls
    // the internal clear routine without `preserveUnselectable`.
    try {
        api.events.on("structures:removed", (payload: { structures?: StructurePos[] }) => {
            const list = payload?.structures;
            if (!Array.isArray(list) || list.length === 0) return;
            let gone = 0;
            for (const s of list) {
                if (s && String(s.type ?? "") === ARTEFACT_ID) gone++;
            }
            if (gone <= 0) return;
            try {
                const cur = Number(map.getPath("nbArtefactPlace") ?? 0);
                map.setPath("nbArtefactPlace", Math.max(0, cur - gone));
                map.commit();
            } catch { /* best-effort */ }
        });
    } catch { /* optional */ }

    const removeStructure = (structure: StructurePos) => {
        // Drop the runtime spiral counter for this cell — it is not persisted,
        // so nothing else would ever release it and the Map would grow.
        try {
            forgetSpiralCounter(structure.x, structure.y);
        } catch { /* best-effort */ }
        try {
            if (typeof api.structures.removeAtCellWhenIdle === "function") {
                api.structures.removeAtCellWhenIdle(structure.x, structure.y);
                return;
            }
        } catch { /* fall through */ }
        try {
            api.structures.removeAtCell?.(structure.x, structure.y);
        } catch { /* best-effort */ }
        try {
            api.structures.remove?.(structure);
        } catch { /* best-effort */ }
    };

    const processFn = (structure: StructurePos) => {
        try {
            let data = { ...(structure.data ?? {}) };
            let ready = Number(data.ready ?? 0);
            let remaining = Number(data.remaining ?? 0);

            // Bootstrap from pending spawn payload if not ready yet
            if (ready !== 1 || remaining <= 0) {
                const pending = takePendingArtefact(structure.x, structure.y);
                if (pending) {
                    data = {
                        ...data,
                        elementType: pending.elementType,
                        remaining: pending.remaining,
                        total: pending.total,
                        progress: pending.progress,
                        max: pending.max,
                        status: pending.status,
                        ready: 1,
                    };
                    remaining = pending.remaining;
                    ready = 1;
                    try {
                        api.structures.updateData?.(structure, data, {
                            propagateToWorkers: true,
                        });
                    } catch { /* best-effort */ }
                    console.log(
                        `${LOG} artefact bootstrapped @${structure.x},${structure.y} ${pending.elementType} x${pending.remaining}`,
                    );
                }
            }

            // Still waiting for spawn data — do not remove
            if (ready !== 1) {
                return;
            }

            // Finished production
            if (remaining <= 0) {
                removeStructure(structure);
                return;
            }

            const elmId = String(data.elementType ?? "sand");
            let elmType = resolveElementType(elmId);
            if (elmType === null) {
                // Fallback to sand rather than self-destruct
                elmType = resolveElementType("sand");
                if (elmType === null) {
                    console.warn(`${LOG} artefact: cannot resolve element ${elmId}`);
                    return; // keep structure, retry next tick
                }
            }

            // Push each new element outward along the current spiral angle so the
            // emission sweeps in step with the aura. Uses the same counter the
            // draw hook advances, so both motions stay locked together.
            let emitted = 0;
            const emitFrame = peekSpiralCounter(structure.x, structure.y);
            const emit = (cx: number, cy: number) => {
                spawnEmittedElement(cx, cy, elmType, emitFrame, emitted);
                emitted++;
            };

            for (const cell of neighbors(structure.x, structure.y)) {
                if (emitted >= ARTEFACT_EMIT_PER_TICK) break;
                if (emitted >= remaining) break;
                if (!isCellEmpty(cell.x, cell.y)) continue;
                emit(cell.x, cell.y);
            }

            // If nothing empty around, try a slightly wider ring next
            if (emitted === 0) {
                for (let r = 2; r <= 3 && emitted < ARTEFACT_EMIT_PER_TICK; r++) {
                    for (let dy = -r; dy <= r; dy++) {
                        for (let dx = -r; dx <= r; dx++) {
                            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                            if (emitted >= ARTEFACT_EMIT_PER_TICK) break;
                            if (emitted >= remaining) break;
                            const cx = structure.x + dx;
                            const cy = structure.y + dy;
                            if (!isCellEmpty(cx, cy)) continue;
                            emit(cx, cy);
                        }
                    }
                }
            }

            if (emitted <= 0) {
                try {
                    api.structures.updateData?.(structure, {
                        ...data,
                        ready: 1,
                        status: `blocked (${elmId})`,
                    }, { propagateToWorkers: true });
                } catch { /* best-effort */ }
                return;
            }

            remaining -= emitted;
            const total = Number(data.total ?? Math.max(remaining + emitted, ARTEFACT_COUNT_MIN));
            const progress = total - remaining;
            try {
                api.structures.updateData?.(structure, {
                    ...data,
                    ready: 1,
                    remaining,
                    elementType: elmId,
                    total,
                    progress,
                    max: total,
                    status: remaining > 0 ? `producing ${elmId}` : "done",
                }, { propagateToWorkers: true });
            } catch { /* best-effort */ }

            if (remaining <= 0) {
                removeStructure(structure);
            }
        } catch (err) {
            console.error(`${LOG} artefact tick failed`, err);
        }
    };

    try {
        if (typeof api.structures.addProcessor === "function") {
            api.structures.addProcessor(structureType, {
                intervalMs: ARTEFACT_INTERVAL_MS,
                process: processFn,
            });
        } else {
            api.structures.processing?.register?.(`${ARTEFACT_ID}:process`, {
                structureType: ARTEFACT_ID,
                intervalMs: ARTEFACT_INTERVAL_MS,
                process: processFn,
            });
        }
    } catch (err) {
        console.error(`${LOG} artefact processor failed`, err);
    }

    console.log(`${LOG} artefact registered ${ARTEFACT_ID} (hidden)`);
}
