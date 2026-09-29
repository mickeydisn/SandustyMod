/**
 * TERRAIN — the solid world: dirt, stone, ice, over a region.
 *
 * The fourth family, and the first whose subject is the world *under* the elements rather
 * than the elements themselves. Same rule as the brief: every engine function taking
 * `cellX`/`cellY` becomes one action, so a process composes them.
 *
 * ## The one family that can be atomic — because of a type declaration
 *
 * The motion and structure families are per-cell and non-atomic, and both said so at
 * length. Terrain is different, and the difference is one line in `grid.d.ts:146-152`:
 *
 * ```
 * interface GridMutationWriter {
 *   elements: GridMutationWriterElements;
 *   terrains: GridMutationWriterTerrains;   // ← this line
 * }
 * ```
 *
 * `GridMutationWriterTerrains` has exactly three methods (`grid.d.ts:193-221`):
 * `createAtCell`, `replaceAtCell`, `removeAtCell`. So the three **shape-changing** writes
 * go through `api.grid.mutate` and are one coherent batch, with the read that decided them
 * inside the same callback — the same property the element family has.
 *
 * The other three writes cannot. `damageAtCell`, `setHitPointsAtCell` and `meltAtCell` are
 * **not** on the writer: they change state, not shape, and there is no writer method for
 * them. So this family is *internally split*, and that is the honest shape of the engine
 * rather than a limitation of the code:
 *
 * | | actions | path | atomic over a region |
 * | --- | --- | --- | --- |
 * | shape | 3 | `api.grid.mutate(w => w.terrains.…)` | **yes** |
 * | state | 3 | `api.terrains.*` per cell | **no** |
 * | reads | 6 | `api.terrains.*` | coherent *inside* a batch |
 *
 * The split is worth stating rather than smoothing over, because "terrain writes are
 * atomic" would be a lie for a third of them, and a program that assumed it would
 * half-apply a damage sweep and never find out.
 *
 * ## `meltAtCell` is documented and does not exist
 *
 * `api.terrains.md` lists `meltAtCell(cx, cy)` in its availability table. It is in no
 * `.d.ts`, in neither the `sandkit` facade nor the `shared` layer, and a grep over the
 * whole engine package finds zero occurrences.
 *
 * So it is **not** an action here, and that is a deliberate refusal rather than an
 * oversight. An action for it would compile, register, appear in the panel, and then call
 * `undefined` — the exact failure this codebase's own motion-family comment calls out as
 * "the worst kind of bug: it compiles, it commits, it returns `true`, and nothing
 * happens." The documentation is wrong; the code is not.
 *
 * ## `getIdByType` exists here, unlike structures
 *
 * The structure family cannot turn a numeric type handle back into a string id —
 * structures have no `getIdByType`. Terrains **do** (`shared/api/terrains.d.ts:68`), and
 * that is why `terrainType` below returns a real id rather than a raw handle, and why
 * `isTerrainType` needs no numeric retry. One family in two has a conversion, and the
 * difference is in the engine.
 *
 * ## Which thread
 *
 * `api.grid.mutate` is ✓ Main / — Worker (`api.grid.md:18`), and `register` is Main-only.
 * This mod ships no `workerEntry`, so every processor it registers runs on Main and
 * `hostNs` reaches the full namespace. The shape writes are therefore the same Main-only
 * assumption the element family already rests on; the state writes and every read are
 * available on **both** entries per the availability table, so they degrade to a warning
 * rather than breaking if a `workerEntry` ever appears.
 *
 * @module
 */
import { defineActions, hostNs } from "../../core/types.ts";
import { MAX_SCAN_SIDE } from "../../core/cell-region.ts";
import { regionFor } from "../element/index.ts";

/** A structure instance, as far as these actions are concerned. */
interface StructureLike {
    x?: number;
    y?: number;
    shape?: number[][];
}

/** A 2D vector, as the engine's `Vector2`. */
interface Vector2 {
    x: number;
    y: number;
}

/** The options every terrain action shares. */
interface TerrainOptions {
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
    /** The terrain id or type handle this action is about. */
    terrain?: unknown;
    /** How much damage to apply, for `damageTerrain`. */
    damage?: unknown;
    /** The hit points to set, for `setTerrainHitPoints`. */
    hitPoints?: unknown;
    /** `true` = skip the shadow update around a changed cell. */
    skipShadow?: unknown;
}

/** `getDataAtCell`'s return, as far as these actions are concerned. */
interface TerrainDataLike {
    cellType?: number;
    hitPoints?: number | null;
    /** Deprecated mirror of `hitPoints`; read only when `hitPoints` is absent. */
    hp?: number | null;
}

/**
 * The `api.terrains` surface this family uses.
 *
 * Declared for the reason `ElementWriter` is: the engine's `.d.ts` files are not in this
 * mod's dependency graph, so `hostNs` gets a structural type.
 *
 * Members are optional because the availability table splits this namespace: `register`
 * and the `*WhenIdle` aliases are Main-only, the rest is Main + Worker. The `WhenIdle`
 * family is **deliberately not** wired — they are deprecated aliases of the deferred main
 * path, so an action reaching for them would be a worse spelling of the non-deferred one.
 */
interface TerrainsApi {
    getTypeAtCell?: (x: number, y: number) => number | null;
    getDataAtCell?: (x: number, y: number) => TerrainDataLike | null;
    isAtCell?: (x: number, y: number) => boolean;
    /**
     * The engine types this as `(cx, cy, terrainId: TerrainId)` — an **id only**, not a
     * `TerrainRef` like `structures.isTypeAtCell` accepts. So a numeric handle is not a
     * declared input here, and the declaration is widened to `string | number` to record
     * the one case the action actually performs: a handle that made a round-trip through
     * a string bind comes back as digits and is retried as a number.
     *
     * Widening the declared parameter is a deliberate mismatch with the engine's own
     * `.d.ts`, not an accident. The alternative is to `String(Number(want))` and pass the
     * same value twice, which is the version the structure family had before it was fixed
     * — and the reason the engine's *runtime* tolerance is unverified either way. What is
     * declared here is what this code sends, so the type error surfaces here rather than
     * being hidden by a redundant cast.
     */
    isTypeAtCell?: (x: number, y: number, id: string | number) => boolean;
    isCellIdTerrain?: (cellId: unknown) => boolean;
    damageAtCell?: (x: number, y: number, damage: number) => void;
    setHitPointsAtCell?: (x: number, y: number, hitPoints: number) => boolean;
    getIdByType?: (type: number) => string;
    getTypeById?: (id: string) => number;
}

/** The terrain half of `api.grid.mutate`'s writer (`grid.d.ts:193-221`). */
interface TerrainWriter {
    createAtCell: (x: number, y: number, type: string | number, options?: unknown) => void;
    replaceAtCell: (x: number, y: number, type: string | number, options?: unknown) => void;
    removeAtCell: (x: number, y: number, options?: unknown) => void;
}

/** A number, or `fallback`. `NaN` must never reach the engine: it is not a cell. */
function num(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** The terrain id or handle an option names, or `""`. */
function refOf(options: TerrainOptions): string {
    return String(options.terrain ?? "");
}

/** `api.terrains`, or `null` on a thread that does not have it. */
function terrains(): TerrainsApi | null {
    return (hostNs("terrains") as TerrainsApi | null) ?? null;
}

/**
 * The cells a terrain action touches, and a warning if the region was clamped.
 *
 * The shared `regionFor`, so "the cell above me" means the same thing in all four
 * families. A clamp is reported rather than swallowed: a `size: 500` that quietly
 * covered 64×64 is a wrong answer dressed as a right one.
 */
function regionCells(
    structure: StructureLike | null,
    options: TerrainOptions,
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
    options: TerrainOptions,
    label: string,
): { x: number; y: number } | null {
    return regionCells(structure, options, label)[0] ?? null;
}

/** `TerrainMutationOptions`, which carries exactly one field. */
function mutationOptions(options: TerrainOptions): Record<string, unknown> | undefined {
    return options.skipShadow === true ? { skipShadow: true } : undefined;
}

/**
 * The shared body of the three **shape-changing** writes: one coherent batch.
 *
 * This is the terrain family answering a question the motion and structure families could
 * not: can a footprint write be atomic? For terrain, yes — because `api.grid.mutate`
 * carries a `terrains` writer (`grid.d.ts:193-221`), and the engine documents `mutate` for
 * "state-dependent grid writes". So the read, the decision and the write for a cell are
 * one atomic step, and there is no read/write gap to guard.
 *
 * `decide` is called **inside** the batch with the writer and the cell, and returns whether
 * that cell was queued. Counting the returns is the only honest success signal available:
 * `mutate` is `void`, so `true` from an action built on this means "cells were
 * **submitted**", not "the engine accepted them". That is a weaker claim than the old
 * `context.commit` boolean and it is not recoverable — the engine returns nothing.
 */
function writeShape(
    structure: unknown,
    options: unknown,
    label: string,
    decide: (
        writer: TerrainWriter,
        cell: { x: number; y: number },
        api: TerrainsApi,
    ) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    // Hoisted out of the callback for the same two reasons as the element family: an
    // optional-chained narrowing does not survive into a closure, and capturing the method
    // once means a context that swapped it mid-batch could not change behaviour halfway.
    const mutate = hostNs("grid")?.mutate;
    if (!s || typeof mutate !== "function") {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.grid.mutate on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const api = terrains();
    if (!api) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: no api.terrains on this thread, so the ` +
                "batch had nothing to decide against",
        );
        return false;
    }
    const o = (options ?? {}) as TerrainOptions;
    const cells = regionCells(s, o, label);
    let queued = 0;
    mutate((writer: { terrains: TerrainWriter }) => {
        for (const cell of cells) {
            if (decide(writer.terrains, cell, api)) queued++;
        }
    });
    return queued > 0;
}

/** Reading the world. All `sense`, all returning a value the panel can bind. */
export const terrainSenseActions = defineActions({
    /**
     * The terrain **id** at a cell. ← `getTypeAtCell` + `getIdByType`
     *
     * Returns `""` for an empty cell, so a bind is always a string and a program never
     * branches on `null`.
     *
     * This is the family where the structure family's trap does not exist. `getTypeAtCell`
     * returns a **number**, but terrains have `getIdByType`
     * (`shared/api/terrains.d.ts:68`), so the handle is converted here and the result is a
     * real id you can type into a panel field. Structures have no such function, which is
     * why `structureType` returns a raw handle and `isStructureType` needs a numeric retry;
     * none of that is needed here, and the difference is the engine's, not the code's.
     *
     * With no `getIdByType` the handle is returned as-is, so the value is still usable —
     * just not a clean id.
     */
    terrainType: {
        role: "sense",
        doc: "Reads the terrain id at a cell. Empty means no terrain. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            if (!s || typeof api?.getTypeAtCell !== "function") return "";
            const o = (options ?? {}) as TerrainOptions;
            const cell = firstCell(s, o, "terrainType");
            if (!cell) return "";
            const type = api.getTypeAtCell(cell.x, cell.y);
            if (type === null || type === undefined) return "";
            if (typeof api.getIdByType === "function") {
                const id = api.getIdByType(type);
                if (id !== undefined && id !== null && id !== "") return String(id);
            }
            return String(type);
        },
    },

    /** `isAtCell` — is there terrain at all. */
    hasTerrain: {
        role: "sense",
        doc: "True when the cell holds terrain. Bind it with As.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            if (!s || typeof api?.isAtCell !== "function") return false;
            const cell = firstCell(s, (options ?? {}) as TerrainOptions, "hasTerrain");
            return cell ? api.isAtCell(cell.x, cell.y) === true : false;
        },
    },

    /**
     * `isTypeAtCell` — the safe way to ask what a cell holds.
     *
     * Takes an id **or** a handle, and needs no numeric-retry dance like the structure
     * family, because this engine has `getIdByType`. That symmetry is the point: the two
     * families' comparison actions read almost identically, and the only difference
     * between them is a conversion function the engine does or does not have.
     */
    isTerrainType: {
        role: "sense",
        doc: "True when the cell holds terrain of the given type. Accepts an id or a " +
            "handle from Terrain type.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!s || !want || typeof api?.isTypeAtCell !== "function") return false;
            const cell = firstCell(s, o, "isTerrainType");
            if (!cell) return false;
            if (api.isTypeAtCell(cell.x, cell.y, want) === true) return true;
            // A handle round-tripped through a bind arrives as a string, so retry a
            // digit-only reference as a number — the same guard as the structure family,
            // and needed for the same reason.
            if (!/^\d+$/.test(want)) return false;
            return api.isTypeAtCell(cell.x, cell.y, Number(want)) === true;
        },
    },

    /**
     * The terrain hit points at a cell. ← `getDataAtCell`
     *
     * Returns `-1` when there is no terrain, **or** when the terrain has no hp. The docs
     * note `hitPoints` is `null` for terrain types that are not breakable, and that is a
     * different "no value" from "no terrain" — collapsing both into one number means a
     * `decide` step has a single failure value to handle rather than two.
     *
     * The engine documents `getDataAtCell` as mirroring `hitPoints` into a deprecated `hp`
     * field, so `hp` is read only as a fallback and never preferred.
     */
    terrainHitPoints: {
        role: "sense",
        doc: "Reads the terrain's hit points at a cell. Returns -1 when there are none. " +
            "Bind it to watch a wall wear down.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            const o = (options ?? {}) as TerrainOptions;
            if (!s || typeof api?.getDataAtCell !== "function") return -1;
            const cell = firstCell(s, o, "terrainHitPoints");
            if (!cell) return -1;
            const data = api.getDataAtCell(cell.x, cell.y);
            if (!data) return -1;
            const hp = data.hitPoints ?? data.hp;
            return typeof hp === "number" && Number.isFinite(hp) ? hp : -1;
        },
    },

    /**
     * The terrain's numeric cell type at a cell, unresolved. ← `getDataAtCell.cellType`
     *
     * Separate from `terrainType` because it is a different question: that one answers
     * "*which* terrain" as a name, this one answers "what handle does the engine hold", for
     * a program comparing against `getDataAtCell` output rather than against a name.
     * Returns `-1` for an empty cell.
     */
    terrainTypeHandle: {
        role: "sense",
        doc: "Reads the engine's own numeric handle for the terrain at a cell. Returns " +
            "-1 when there is none.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            if (!s || typeof api?.getDataAtCell !== "function") return -1;
            const o = (options ?? {}) as TerrainOptions;
            const cell = firstCell(s, o, "terrainTypeHandle");
            if (!cell) return -1;
            const type = api.getDataAtCell(cell.x, cell.y)?.cellType;
            return typeof type === "number" && Number.isFinite(type) ? type : -1;
        },
    },

    /**
     * How many cells in the region hold terrain.
     *
     * **Not** an engine function — a region scan over `isAtCell`, and the reason the
     * brief's rule had to be read as a starting point rather than a literal list. It earns
     * its place because "how much wall is left" is the question a builder asks before
     * placing anything, and asking it one cell at a time in the panel is not expressible.
     *
     * A derived action is worth exactly what its inputs are: the count is as coherent as
     * the reads behind it, and those reads happen **outside** any batch, so on Main they
     * see the pre-flush world.
     */
    countTerrain: {
        role: "sense",
        doc: "Counts cells holding terrain in the region. Bind it to size a footprint.",
        fn: (structure, _context, options) => {
            const s = (structure ?? null) as StructureLike | null;
            const api = terrains();
            if (!s || typeof api?.isAtCell !== "function") return 0;
            const o = (options ?? {}) as TerrainOptions;
            let found = 0;
            for (const cell of regionCells(s, o, "countTerrain")) {
                if (api.isAtCell(cell.x, cell.y)) found++;
            }
            return found;
        },
    },
});

/**
 * The shared body of the **state** writes, which have no writer method.
 *
 * `damageAtCell` and `setHitPointsAtCell` change terrain state, not shape, and the writer
 * has no method for either. So these are one call per cell and a region sweep can
 * half-apply — stated once here rather than in every doc string, and the reason the module
 * header calls this family internally split.
 */
/**
 * The shared body of the **state** writes, which have no writer method.
 *
 * `damageAtCell` and `setHitPointsAtCell` change terrain state, not shape, and the writer
 * has no method for either. So these are one call per cell and a region sweep can
 * half-apply — stated once here rather than in every doc string, and the reason the module
 * header calls this family internally split.
 */
function writeState(
    structure: unknown,
    options: unknown,
    label: string,
    act: (api: TerrainsApi, cell: { x: number; y: number }) => boolean,
): boolean {
    const s = structure as StructureLike | null;
    const api = terrains();
    if (!s || !api) {
        console.warn(
            `[md-my-hown-mod:process] ${label}: api.terrains is not on this thread, so ` +
                "nothing was written",
        );
        return false;
    }
    const o = (options ?? {}) as TerrainOptions;
    let wrote = false;
    for (const cell of regionCells(s, o, label)) {
        if (act(api, cell)) wrote = true;
    }
    return wrote;
}

/**
 * Changing the world. All `act`, all writes — and **internally split**: three of these are
 * atomic and two are per-cell.
 */
export const terrainActActions = defineActions({
    /**
     * `createAtCell` — place terrain, atomically. ← `w.terrains.createAtCell`
     *
     * Goes through the `api.grid.mutate` writer, so a footprint create is **one coherent
     * batch** and a read in the same step sees the world it is writing. That is a stronger
     * guarantee than the motion and structure families can make, and it is the reason this
     * is not a loop of `api.terrains.createAtCell` calls — that function exists and would
     * be the obvious, wrong choice.
     *
     * Only cells with no terrain are created, matching the engine's own rule that create
     * applies "only if `world.isCellEmpty`". An occupied cell is skipped rather than
     * overwritten; use `replaceTerrain` to overwrite deliberately.
     */
    createTerrain: {
        role: "act",
        doc: "Creates terrain of the given type in empty cells. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] createTerrain: no terrain type set");
                return false;
            }
            return writeShape(structure, options, "createTerrain", (writer, cell, api) => {
                // The check is inside the batch, so a second action over an overlapping
                // region in the same process sees the first one's creates.
                if (typeof api.isAtCell === "function" && api.isAtCell(cell.x, cell.y)) {
                    return false;
                }
                writer.createAtCell(cell.x, cell.y, want, mutationOptions(o));
                return true;
            });
        },
    },

    /**
     * `replaceAtCell` — overwrite terrain whatever is there, atomically.
     *
     * The destructive counterpart to `createTerrain`, and what makes compare-and-replace
     * possible: read the type inside the same batch, then replace it, with no tick in
     * between for anything else to change the cell.
     */
    replaceTerrain: {
        role: "act",
        doc: "Replaces terrain in every cell of the region. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const want = refOf(o);
            if (!want) {
                console.warn("[md-my-hown-mod:process] replaceTerrain: no terrain type set");
                return false;
            }
            return writeShape(structure, options, "replaceTerrain", (writer, cell) => {
                writer.replaceAtCell(cell.x, cell.y, want, mutationOptions(o));
                return true;
            });
        },
    },

    /**
     * `removeAtCell` — clear terrain, atomically. ← `w.terrains.removeAtCell`
     *
     * One batch for the region, and the engine removes only where there is terrain, so
     * empty cells are skipped by the engine rather than by a pre-check here. Deliberate:
     * an extra read inside the batch would cost a lookup per cell to learn something the
     * engine already knows.
     */
    removeTerrain: {
        role: "act",
        doc: "Removes terrain from every cell of the region. One atomic batch.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            return writeShape(structure, options, "removeTerrain", (writer, cell) => {
                writer.removeAtCell(cell.x, cell.y, mutationOptions(o));
                return true;
            });
        },
    },

    /**
     * `damageAtCell` — break terrain down. **Per cell, not batched.**
     *
     * The first of the state writes, and the clearest case of the family's split: there is
     * no `w.terrains.damageAtCell`, so this is one `api.terrains` call per cell and a region
     * sweep can half-apply. A `true` here means "N calls were made", not "one transaction
     * landed" — which is why the return should not be branched on.
     *
     * The engine destroys terrain at zero hit points, so this does not check for it.
     */
    damageTerrain: {
        role: "act",
        doc: "Damages terrain in the region. Per-cell, so a large area can half-apply.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const amount = num(o.damage, 0);
            if (amount <= 0) {
                console.warn(
                    "[md-my-hown-mod:process] damageTerrain: no damage amount, so there " +
                        "was nothing to do",
                );
                return false;
            }
            return writeState(structure, options, "damageTerrain", (api, cell) => {
                if (typeof api.damageAtCell !== "function") return false;
                api.damageAtCell(cell.x, cell.y, amount);
                return true;
            });
        },
    },

    /**
     * `setHitPointsAtCell` — set terrain health directly. **Per cell, not batched.**
     *
     * The repair half of `damageTerrain`, and the reason a wall can be rebuilt: damage only
     * ever subtracts, so restoring one needs a setter. The engine also has `setHpAtCell` as
     * a deprecated alias of this same call, and it is not wired — one action per function,
     * using the current spelling.
     */
    setTerrainHitPoints: {
        role: "act",
        doc: "Sets the terrain's hit points in the region. Use it to repair a wall.",
        fn: (structure, _context, options) => {
            const o = (options ?? {}) as TerrainOptions;
            const hp = num(o.hitPoints, -1);
            if (hp < 0) {
                console.warn(
                    "[md-my-hown-mod:process] setTerrainHitPoints: no hit points set, and " +
                        "a negative value is not one",
                );
                return false;
            }
            return writeState(structure, options, "setTerrainHitPoints", (api, cell) => {
                if (typeof api.setHitPointsAtCell !== "function") return false;
                return api.setHitPointsAtCell(cell.x, cell.y, hp);
            });
        },
    },
});

/**
 * Every terrain action, in panel order.
 *
 * One export rather than two, for the reason the structure family has one: these are not
 * separate families but one surface split by role, and the action index flattens by role
 * anyway.
 */
export const terrainActions = {
    ...terrainSenseActions,
    ...terrainActActions,
};
