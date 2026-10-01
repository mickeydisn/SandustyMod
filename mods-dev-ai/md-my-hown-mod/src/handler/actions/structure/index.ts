/**
 * STRUCTURE — reading and driving placed buildings, over a region.
 *
 * The third family, and the first whose subject is the **buildings** rather than what is
 * inside them. The rule is the one the brief gave: every engine function taking
 * `cellX`/`cellY` or a structure instance becomes one action, so a process can compose
 * them instead of being hand-written JavaScript.
 *
 * ## Why this family cannot be atomic, and it is not the engine's fault
 *
 * The element family got a coherent write batch out of `ns.grid.mutate`. Not available
 * here, and the reason is one type declaration (`grid.d.ts:147-150`):
 *
 * ```
 * interface GridMutationWriter {
 *   elements: GridMutationWriterElements;
 *   terrains: GridMutationWriterTerrains;
 * }                                       // ← no `structures`
 * ```
 *
 * The writer batches **elements and terrain only**. `buildAtCell`, `removeAtCell`,
 * `setEnabledAtCell` and `updateData` are per-instance calls on `ns.structures`, and no
 * writer exists for them. So this family is structurally identical to MOTION: one call
 * per cell, no transaction, reads that see the old value.
 *
 * The exception is `removeAtCells(positions[])` — **one** call for a list. It is the only
 * batched structure write that exists, and why `removeStructures` is a separate action
 * from `removeStructure` rather than one action with a mode flag: they are genuinely
 * different engine calls with different failure modes.
 *
 * ## Why the whole family is `api`-bound
 *
 * `StructureProcessingContext` has **no** structure members. Its entire surface is
 * `getResolvedTypeAtCell`, `isCellEmptyAtCell`, `commit` and two deprecated aliases — all
 * about cells and elements. No `getStructureAtCell`, no `setEnabledAtCell`, nothing. Every
 * action here reaches `ns.structures.*`, so every one measures `api` / scope `["pos"]`.
 * This is the cleanest classification in the catalogue: not a judgement call, the only
 * option.
 *
 * (The docs' prose for the processing section lists `isEnabledAtCell` and
 * `setEnabledAtCell` as context helpers. The **type** does not have them, and this family
 * follows the type — so enablement goes through `ns.structures.processing`.)
 *
 * ## The type-handle trap, which is the sharpest edge here
 *
 * `Structure` declares only `x`, `y`, `trapped?`, `data?` — there is **no declared `type`
 * field**, and there is **no** `getIdByType` for structures (only `getTypeById`, which
 * goes id → number). The engine hands you a numeric handle where an author expects a
 * string id, and documents no way back.
 *
 * `structureType` returns that handle as-is rather than pretending it is an id, because
 * `StructureRef = StructureType | StructureId` — a handle is a **valid input** to
 * `isStructureType` and `buildStructure`, so it composes. It is not good for string
 * equality against an id you typed, which is what `isStructureType` is for. Both exist
 * because an author needs each, and the difference is documented on both.
 *
 * ## Deliberately not actions
 *
 * The brief said every cell- or instance-taking function, and the boundary is stated so
 * the omissions read as decisions rather than oversights:
 *
 * - **Registration** — `register`, `updateDefinition`, `registerVariant`, `addVariant`,
 *   `registerPlacementConfig`, `recipes.register`, `processing.register`. All mod-init and
 *   Main-only. A *per-tick process* that registered a structure type would be a bug, and
 *   an action inviting it is worse than its absence.
 * - **Type-level queries** — `getAvailableTypes`, `getUnlockedTypes`, `isLockedByType`,
 *   `isUnlockedByType`, `getDefinitionByType`, `getTypeById`. These take a *type*, not a
 *   cell or instance, so they fall outside the rule. `getTypeById` is the one that hurts:
 *   the only way to turn an id into something comparable, and one step short of what
 *   `structureType` needs. Documented above rather than faked here.
 * - **Iteration** — `forEachOfType(typeOrId, callback)`. Takes a callback, so it has no
 *   place in a data-flow program; a region scan is the composable equivalent.
 * - **Deprecated aliases** — `addVariant`, `getTypeFromId`, `removeAtCellWhenIdle`,
 *   `removeAtCellsWhenIdle`, `removeBetweenCellsWhenIdle`, `isEnabledAt`, `setEnabledAt`.
 *   Each has a current form in this file.
 *
 * @module
 */
import { api, defineActions } from "../../core/types.ts";
import { MAX_SCAN_SIDE } from "../../core/cell-region.ts";
import { regionFor } from "../element/index.ts";

/** A 2D vector, as the engine's `Vector2`. */
interface Vector2 {
    x: number;
    y: number;
}

/** A structure instance, as far as these actions are concerned. */
interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}

/** A live structure, as `getAtCell` returns one. `type` is undeclared by the engine. */
interface StructureRecord {
    x?: number;
    y?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}

/** Reading a building. All `sense`, all returning a value the panel can bind. */
export const structureSenseActions = defineActions({
    /**
     * The **type handle** of the structure at a cell. ← `getAtCell`
     *
     * Returns `""` for an empty cell, so a bind is always a string and a program never
     * branches on `null`.
     *
     * What comes back is the engine's own `StructureRef` — usually a **number**, not the id
     * you typed. `StructureRef` is the union of both, so the result feeds straight back
     * into `isStructureType` or `buildStructure` and will match. It will *not* equal your
     * id under `===`, because no `getIdByType` exists for structures to convert it with.
     * Compare with `isStructureType` instead.
     */
    structureType: {
        role: "sense",
        doc: "Reads the type of the structure at a cell and returns the engine's own " +
            "handle for it. Feed it back into Is structure type — do not compare it to " +
            "an id by hand.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.getAtCell !== "function") return "";
            const o = (options ?? {}) as StructureOptions;
            // Undeclared on the engine's `Structure` interface, so this read is the index
            // signature doing the work. Absent for a structure with no type handle, and
            // then there is nothing truthful to return but the empty string.
            const type = at(ns, s, o, "structureType")?.type;
            return type === undefined || type === null ? "" : String(type);
        },
    },

    /** `hasBuiltAtCell`, as a bindable boolean. */
    hasStructure: {
        role: "sense",
        doc: "True when a structure has been built at the cell. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.hasBuiltAtCell !== "function") return false;
            const cell = firstCell(s, (options ?? {}) as StructureOptions, "hasStructure");
            return cell ? ns.hasBuiltAtCell(cell.x, cell.y) === true : false;
        },
    },

    /**
     * `isTypeAtCell` — the safe way to ask what a cell holds.
     *
     * Takes an id **or** a handle, which makes it the counterpart to `structureType`.
     *
     * It has to cope with both string forms because a **bind is a string**. `structureType`
     * reads the engine's numeric type handle and stringifies it for the panel, so a
     * round-trip through `as` arrives back here as `"42"` while the engine still holds the
     * number `42` — and `42 === "42"` is false. That is not hypothetical: it is what the
     * first version of this action did, and its own test caught it.
     *
     * So a purely numeric reference is tried as a number too. The fallback is narrow on
     * purpose: `isTypeAtCell` is called with the string first, and the numeric retry only
     * runs when the first answer was false and the text is entirely digits. An id like
     * `"gizmo42"` is never coerced, because a structure id that looks like a number would
     * be a coincidence and coercing it would be a guess.
     *
     * There is no cleaner fix available: the engine has `getTypeById` (id → number) but
     * **no** `getIdByType` for structures, so the reverse direction has to be handled
     * wherever the comparison happens rather than at conversion time.
     */
    isStructureType: {
        role: "sense",
        doc: "True when the cell holds a structure of the given type. Accepts an id or " +
            "a handle from Structure type.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            const o = (options ?? {}) as StructureOptions;
            const want = refOf(o);
            if (!s || !want || typeof ns?.isTypeAtCell !== "function") return false;
            const cell = firstCell(s, o, "isStructureType");
            if (!cell) return false;
            if (ns.isTypeAtCell(cell.x, cell.y, want) === true) return true;
            // A bind stringified a numeric handle on the way in. Retry as a number, and
            // only when the text is entirely digits — see the doc comment.
            if (!/^\d+$/.test(want)) return false;
            return ns.isTypeAtCell(cell.x, cell.y, Number(want)) === true;
        },
    },

    /**
     * `isType` — the same question, asked of **my own** instance.
     *
     * The instance form: "am I the thing I think I am", with no offsets and no region.
     * Worth having beside `isStructureType` because they answer different questions — this
     * one asks about the structure the process is running on, that one about whatever is
     * at a cell which may be somewhere else entirely.
     */
    isMyType: {
        role: "sense",
        doc: "True when **this** structure is of the given type. No offsets — it asks " +
            "about the instance the process is running on.",
        fn: (structure, _context, options) => {
            const s = structure as StructureRecord | null;
            const ns = structures();
            const want = refOf((options ?? {}) as StructureOptions);
            if (!s || !want || typeof ns?.isType !== "function") return false;
            return ns.isType(s, want) === true;
        },
    },

    /** `isBlockedByPlayerAtCell`. Main-only, so `false` on a worker rather than a throw. */
    isBlockedByPlayer: {
        role: "sense",
        doc: "True when a player has blocked building at the cell.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.isBlockedByPlayerAtCell !== "function") return false;
            const o = (options ?? {}) as StructureOptions;
            const cell = firstCell(s, o, "isBlockedByPlayer");
            return cell ? ns.isBlockedByPlayerAtCell(cell.x, cell.y) === true : false;
        },
    },

    /** `isLauncherAtCell` — gates placement rules, so a builder needs it. */
    isLauncher: {
        role: "sense",
        doc: "True when the cell is a structure launcher.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.isLauncherAtCell !== "function") return false;
            const cell = firstCell(s, (options ?? {}) as StructureOptions, "isLauncher");
            return cell ? ns.isLauncherAtCell(cell.x, cell.y) === true : false;
        },
    },

    /**
     * `processing.isEnabledAtCell` — is the cell's processor switched on?
     *
     * The read half of the enable pair, and worth binding on its own: "only act when I am
     * enabled" is checkable *before* an action does work, where a write-only action can
     * only report after the fact.
     */
    isStructureEnabled: {
        role: "sense",
        doc: "True when processing is enabled at the cell. Bind it to gate later steps.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.processing?.isEnabledAtCell !== "function") return false;
            const o = (options ?? {}) as StructureOptions;
            const cell = firstCell(s, o, "isStructureEnabled");
            return cell ? ns.processing.isEnabledAtCell(cell.x, cell.y) === true : false;
        },
    },

    /**
     * How many structures are in the region.
     *
     * **Not** an engine function — a region scan over `hasBuiltAtCell`, and the reason the
     * brief's rule had to be read as a starting point rather than a literal list. It earns
     * its place because "is my footprint clear" is what a builder asks before placing
     * anything, and answering it one cell at a time in the panel is not expressible.
     *
     * A derived action is worth exactly what its inputs are: the count is as coherent as
     * the reads behind it, and on Main those are the pre-flush values.
     */
    countStructures: {
        role: "sense",
        doc: "Counts structures in the region. Bind it to check a footprint is clear " +
            "before building.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.hasBuiltAtCell !== "function") return 0;
            const o = (options ?? {}) as StructureOptions;
            let found = 0;
            for (const cell of regionCells(s, o, "countStructures")) {
                if (ns.hasBuiltAtCell(cell.x, cell.y)) found++;
            }
            return found;
        },
    },

    /**
     * One key out of a structure's data bag, **bindable**. ← `getAtCell` + `data`
     *
     * The engine-side counterpart to the REMEMBER family's `structureReadData`, which only
     * logs. This one returns the value, so it can be compared, counted or fed onward — the
     * difference between a diagnostic and a program.
     *
     * Reads the **cell's** instance rather than the payload the process was handed, so it
     * works for a neighbouring structure as well as for self.
     */
    structureData: {
        role: "sense",
        doc: "Reads one key from the structure's saved data and returns it. Bind it " +
            "with As. Returns the empty string when the key is absent.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            const o = (options ?? {}) as StructureOptions;
            const key = String(o.key ?? "");
            if (!s || !key || !ns) return "";
            const value = at(ns, s, o, "structureData")?.data?.[key];
            return value === undefined || value === null ? "" : String(value);
        },
    },
});

/** Driving a building. All `act`, all writes. */
export const structureActActions = defineActions({
    /**
     * `buildAtCell` — place a structure.
     *
     * Main-only and per cell. Over a region this is N independent placements, so a
     * footprint can be half-built: the same non-atomicity as MOTION, for the same reason
     * (there is no structures writer on `ns.grid.mutate`).
     */
    buildStructure: {
        role: "act",
        doc: "Builds a structure of the given type at the cell.",
        fn: (structure, _context, options) => {
            const want = refOf((options ?? {}) as StructureOptions);
            if (!want) {
                console.warn("[md-my-hown-mod:process] buildStructure: no structure type set");
                return false;
            }
            return writeEach(structure, options, "buildStructure", (ns, cell) => {
                if (typeof ns.buildAtCell !== "function") return false;
                ns.buildAtCell(cell.x, cell.y, want);
                return true;
            });
        },
    },

    /**
     * `removeAtCell` — take down one structure.
     *
     * The single-cell form, kept separate from `removeStructures` because the engine calls
     * differ: this is one call per cell with no shared transaction, `removeAtCells` is one
     * call for the whole list. A program clearing a footprint wants the second and should
     * not have to know the first exists.
     */
    removeStructure: {
        role: "act",
        doc: "Removes the structure at the cell. Use Remove structures to clear a whole " +
            "region in one call.",
        fn: (structure, _context, options) => {
            return writeEach(structure, options, "removeStructure", (ns, cell) => {
                if (typeof ns.removeAtCell !== "function") return false;
                ns.removeAtCell(
                    cell.x,
                    cell.y,
                    removalOptions((options ?? {}) as StructureOptions),
                );
                return true;
            });
        },
    },

    /**
     * `removeAtCells` — clear a region in **one** engine call.
     *
     * The only batched structure write that exists, and the one place in this family where
     * a footprint write is a single call rather than N. Whether the engine treats that call
     * as atomic is stated nowhere, so this does not claim it: the honest claim is "one
     * call", which is a fact about the payload and not about the engine's internals.
     *
     * A "position" is a point, not a structure, so a multi-cell building clears from
     * whichever of its cells falls in the region.
     */
    removeStructures: {
        role: "act",
        doc: "Removes every structure in the region with a single engine call. Prefer " +
            "this to Remove structure over an area.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const ns = structures();
            if (!s || typeof ns?.removeAtCells !== "function") {
                console.warn(
                    "[md-my-hown-mod:process] removeStructures: api.structures." +
                        "removeAtCells is not on this thread, so nothing was removed",
                );
                return false;
            }
            const o = (options ?? {}) as StructureOptions;
            const positions = regionCells(s, o, "removeStructures");
            if (positions.length === 0) return false;
            ns.removeAtCells(positions, removalOptions(o));
            return true;
        },
    },

    /**
     * `processing.setEnabledAtCell` — switch a processor on or off.
     *
     * The write half of the pair with `isStructureEnabled`. Marked "limited" on Worker in
     * the availability matrix, so on a worker thread this returns false rather than
     * pretending.
     */
    setStructureEnabled: {
        role: "act",
        doc: "Enables or disables processing at the cell.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            return writeEach(structure, options, "setStructureEnabled", (ns, cell) => {
                if (typeof ns.processing?.setEnabledAtCell !== "function") return false;
                ns.processing.setEnabledAtCell(cell.x, cell.y, o.enabled === true);
                return true;
            });
        },
    },

    /**
     * `setSpritesheetIndex` — set a structure's frame directly.
     *
     * A **per-instance** visual, not the type's sprite: the level-gauge needle, the progress
     * bar, the indicator light. Both engine forms are wired — the `AtCell` one addresses a
     * point, the instance form is the fallback for a thread holding half the namespace — so
     * the action does the obvious thing either way.
     */
    setSpritesheetIndex: {
        role: "act",
        doc: "Sets this instance's spritesheet frame. Bind a number to it for a gauge.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const frame = num(o.index, 0);
            return writeEach(structure, options, "setSpritesheetIndex", (ns, cell) => {
                if (typeof ns.setSpritesheetIndexAtCell === "function") {
                    ns.setSpritesheetIndexAtCell(cell.x, cell.y, frame);
                    return true;
                }
                if (typeof ns.setSpritesheetIndex === "function") {
                    const found = ns.getAtCell?.(cell.x, cell.y) ?? null;
                    if (!found) return false;
                    ns.setSpritesheetIndex(found, frame);
                    return true;
                }
                return false;
            });
        },
    },

    /**
     * `setSpritesheetIndexByValue` — pick the frame from a value and a threshold list.
     *
     * The "read a number, show a bar" action, and why `mapSpritesheetValue` exists as a
     * separate pure: a program wanting the frame **and** to branch on it would otherwise
     * map twice, and mapping twice is how two copies drift apart.
     */
    setSpritesheetByValue: {
        role: "act",
        doc: "Sets the frame by mapping a value onto a threshold list — the progress bar. " +
            "Thresholds are comma-separated, ascending.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const value = float(o.value2, 0);
            const thresholds = thresholdsOf(o);
            if (thresholds.length === 0) {
                console.warn(
                    "[md-my-hown-mod:process] setSpritesheetByValue: no thresholds, so there " +
                        "is no frame to choose",
                );
                return false;
            }
            return writeEach(structure, options, "setSpritesheetByValue", (ns, cell) => {
                if (typeof ns.setSpritesheetIndexByValueAtCell === "function") {
                    ns.setSpritesheetIndexByValueAtCell(cell.x, cell.y, value, thresholds);
                    return true;
                }
                if (typeof ns.setSpritesheetIndexByValue === "function") {
                    const found = ns.getAtCell?.(cell.x, cell.y) ?? null;
                    if (!found) return false;
                    ns.setSpritesheetIndexByValue(found, value, thresholds);
                    return true;
                }
                return false;
            });
        },
    },

    /**
     * `updateData` — merge one key into the instance's data bag.
     *
     * The proper write. `updateData` merges for you, on the engine's side, and
     * `propagateToWorkers` is what that flag is for: instance data lives on Main, and a
     * worker that must see the change immediately needs it sent.
     *
     * Contrast the REMEMBER family's `structureWriteData`, which assigns
     * `structure.data[key]` in place and **never pushes it**. That mutates a local object
     * and only reaches the engine if something else calls `update`. See `pushStructure` for
     * the other half, and note this action makes the in-place approach unnecessary rather
     * than merely discouraged.
     */
    setStructureData: {
        role: "act",
        doc: "Writes one key into the structure's saved data, through the engine. Use " +
            "Number value for a numeric field.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const partial = dataPartial(o);
            if (!partial) {
                console.warn("[md-my-hown-mod:process] setStructureData: no key set");
                return false;
            }
            return writeEach(structure, options, "setStructureData", (ns, cell) => {
                if (typeof ns.updateData !== "function") return false;
                const found = ns.getAtCell?.(cell.x, cell.y) ?? null;
                if (!found) return false;
                ns.updateData(found, partial, {
                    propagateToWorkers: o.propagateToWorkers === true,
                });
                return true;
            });
        },
    },

    /**
     * `update` — push a record whose data you mutated yourself.
     *
     * The missing half of the in-place pattern, and the reason this is an action rather than
     * a refactor of the REMEMBER family. The engine splits the job: mutate
     * `structure.data`, then `update` to push the whole record. Anything that assigns to
     * `.data` directly — `structureWriteData` and `triggerTick` both do — is holding an
     * un-pushed change until something calls this.
     *
     * That is a real pattern rather than a wart: a process can accumulate with
     * `structureWriteData` and commit once with `pushStructure` at the end of the tick,
     * instead of pushing on every write.
     */
    pushStructure: {
        role: "act",
        doc: "Pushes this structure's data to the engine. Only needed after an action " +
            "that edits the data bag in place.",
        fn: (structure, _context, options) => {
            const s = structure as StructureRecord | null;
            const ns = structures();
            if (!s || typeof ns?.update !== "function") return false;
            const o = (options ?? {}) as StructureOptions;
            ns.update(s, { propagateToWorkers: o.propagateToWorkers === true });
            return true;
        },
    },
});

/**
 * `mapValueToSpritesheetIndex` — the mapper, as a pure action.
 *
 * The one member of this file taking neither a cell nor an instance, and here because the
 * rule is "everything that takes one" and this is the exception that earns its place:
 * `setSpritesheetByValue` maps **and** writes, so a program that wants the frame as a
 * value — to bind it, compare it, or send it to a *different* structure — has no other way
 * to get it. Exposing the engine's own mapper keeps the returned number identical to the
 * one the engine would have chosen.
 *
 * Returns `-1` for "no frame" — no thresholds, or no mapper on this thread — which is the
 * same failure convention the motion family uses for "no particle to measure".
 */
export const structurePureActions = defineActions({
    mapSpritesheetValue: {
        role: "sense",
        doc: "Maps a value onto a threshold list and returns the frame index the engine " +
            "would pick. Thresholds are comma-separated, ascending.",
        fn: (_structure, _context, options) => {
            const o = (options ?? {}) as StructureOptions;
            const ns = structures();
            const thresholds = thresholdsOf(o);
            if (thresholds.length === 0 || typeof ns?.mapValueToSpritesheetIndex !== "function") {
                return -1;
            }
            const frame = ns.mapValueToSpritesheetIndex(float(o.value2, 0), thresholds);
            return Number.isFinite(frame) ? num(frame, -1) : -1;
        },
    },
});

/**
 * Every structure action, in panel order.
 *
 * One export rather than three, because the three are not three families — they are one
 * surface split by role, and the action index flattens by role anyway. The `act` group
 * comes last so the panel's write actions are the ones an author reaches for.
 */
export const structureActions = {
    ...structureSenseActions,
    ...structurePureActions,
    ...structureActActions,
};

/** The options every structure action shares. */
interface StructureOptions {
    /** Offset from the structure's own cell. The region origin when no size is given. */
    dx?: unknown;
    dy?: unknown;
    /** Region side. 0 or absent means the single cell at the offset. */
    size?: unknown;
    /** `true` = work over my own footprint matrix, occupied cells only. */
    footprint?: unknown;
    /** Matrix column, when addressing the footprint directly. */
    mx?: unknown;
    /** Matrix row, when addressing the footprint directly. */
    my?: unknown;
    /** The structure id or type handle this action is about. */
    structure?: unknown;
    /** Instance data key. */
    key?: unknown;
    /** Instance data value, written as a string. */
    value?: unknown;
    /** Instance data value, written as a number. Wins over `value` when set. */
    numberValue?: unknown;
    /** `true` = also remove the terrain cells under the structure. */
    removeCells?: unknown;
    /** `true` = skip the teardown visuals. */
    skipVisuals?: unknown;
    /** `true` = only remove structures a player cannot currently select. */
    preserveUnselectable?: unknown;
    /** `true` = send the change to workers immediately. */
    propagateToWorkers?: unknown;
    /** `true`/`false` for the enable actions. */
    enabled?: unknown;
    /** A spritesheet frame index. */
    index?: unknown;
    /** The value to map onto a frame, for the spritesheet mappers. */
    value2?: unknown;
    /** Comma- or space-separated ascending thresholds for the spritesheet mappers. */
    thresholds?: unknown;
}

/**
 * The `ns.structures` surface this family uses.
 *
 * Declared rather than imported for the reason `ElementWriter` is: the engine's `.d.ts`
 * files are not in this mod's dependency graph, so `sk()` gets a structural type. Every
 * member is **optional**, and that is not hedging — it is the Main/Worker split. Most of
 * these are ✓ Main / — Worker, so on a worker thread they are genuinely absent and
 * `typeof x !== "function"` is the correct test rather than a paranoid one.
 */

/** A number, or `fallback`. `NaN` must never reach the engine: it is not a cell. */
function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** A float, for the one place the engine wants a real number rather than a cell. */
function float(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** The structure id or handle an option names, or `""`. */
function refOf(options: StructureOptions): string {
    return String(options.structure ?? "");
}

/**
 * The `ns.structures` surface this family uses.
 *
 * Derived from the wrapper rather than re-declared. This used to be a local
 * `StructuresApi` interface with every member optional, reached through
 * `api?.structures as StructuresApi`. The cast asserted members the wrapper did
 * not have, so the action compiled, the methods were `undefined` at run time, and
 * every structure action quietly returned "nothing to do". Deriving the type from
 * the wrapper makes the compiler check this file against the real surface, so the
 * same drift cannot come back.
 */
type StructuresNamespace = typeof api.structures;

/** `ns.structures`, or `null` on a thread that does not have it. */
function structures(): StructuresNamespace | null {
    return api?.structures ?? null;
}

/**
 * The cells a structure action touches, and a one-time warning if the region was clamped.
 *
 * The shared `regionFor`, so "the cell above me" means the same thing in all three
 * families. A clamp is reported rather than swallowed: a `size: 500` that quietly
 * covered 64×64 is a wrong answer dressed as a right one.
 */
function regionCells(
    structure: StructureLike | null,
    options: StructureOptions,
    label: string,
): { x: number; y: number }[] {
    const resolved = regionFor(structure ?? {}, options as never);
    if ("error" in resolved) {
        console.warn(`[md-my-hown-mod:process] ${label}: ${resolved.error}`);
        return [];
    }
    if (resolved.clamped) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: range clamped to ${MAX_SCAN_SIDE}×` +
                `${MAX_SCAN_SIDE} — this call covered less than you asked for`,
        );
    }
    return resolved.range.map((cell) => ({ x: cell.x, y: cell.y }));
}

/** The first cell of the region, or `null` when the region resolved to nothing. */
function firstCell(
    structure: StructureLike | null,
    options: StructureOptions,
    label: string,
): { x: number; y: number } | null {
    return regionCells(structure, options, label)[0] ?? null;
}

/** The structure instance at a cell, or `null`. */
function at(
    ns: StructuresNamespace,
    structure: StructureLike | null,
    options: StructureOptions,
    label: string,
): StructureRecord | null {
    if (typeof ns.getAtCell !== "function") return null;
    const cell = firstCell(structure, options, label);
    if (!cell) return null;
    return ns.getAtCell(cell.x, cell.y) ?? null;
}

/** `StructureRemovalOptions` / `StructureBulkRemovalOptions`, from the booleans given. */
function removalOptions(options: StructureOptions): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    if (options.removeCells === true) out.removeCells = true;
    if (options.skipVisuals === true) out.skipVisuals = true;
    if (options.preserveUnselectable === true) out.preserveUnselectable = true;
    return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The `partial` a data write sends: one key, as a number when `numberValue` is set.
 *
 * Two params rather than a `valueKind` choice, because a bound variable is always a
 * string and instance data frequently wants a number. `{ channel: "3" }` where the
 * machine reads `channel === 3` is a silent failure, and the worst kind: it survives
 * testing because everything still looks wired up.
 *
 * `numberValue` defaults to the empty string, the only value that means "unset"; `0` is
 * a legitimate number and is sent as one.
 */
function dataPartial(options: StructureOptions): Record<string, unknown> | null {
    const key = String(options.key ?? "");
    if (!key) return null;
    const asNumber = options.numberValue;
    if (asNumber !== undefined && asNumber !== "" && Number.isFinite(Number(asNumber))) {
        return { [key]: Number(asNumber) };
    }
    return { [key]: String(options.value ?? "") };
}

/** The threshold list for the spritesheet mappers, from a comma-separated option. */
function thresholdsOf(options: StructureOptions): number[] {
    const raw = String(options.thresholds ?? "");
    if (!raw) return [];
    return raw
        .split(/[\s,]+/)
        .filter((part) => part.length > 0)
        .map(Number)
        .filter((n) => Number.isFinite(n));
}

/**
 * The shared body of the per-cell structure writes: resolve, then write each cell.
 *
 * Deliberately **not** batched, and the comment on the module says why there is nothing
 * to batch into. So a footprint write here is N independent engine calls and can
 * half-apply — stated here once, rather than in every doc string.
 */
function writeEach(
    structure: unknown,
    options: unknown,
    label: string,
    act: (ns: StructuresNamespace, cell: { x: number; y: number }) => boolean,
): boolean {
    const s = (structure ?? null) as StructureLike | null;
    const ns = structures();
    if (!s || !ns) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: api.structures is not on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as StructureOptions;
    let wrote = false;
    for (const cell of regionCells(s, o, label)) {
        if (act(ns, cell)) wrote = true;
    }
    return wrote;
}
