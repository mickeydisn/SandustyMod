/**
 * Thin read/write adapter over the engine's per-cell element API (worker side).
 * All engine access is guarded/try-caught so a single bad cell read never
 * breaks the profile loop.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/shared";

let cachedEmpty: TElementType | null = null;

/**
 * Vote-memory vector encoding (see `Grid.readVecAt`). Scale 4 keeps the
 * quantisation step at 0.25 velocity units; a full-strength tick vector
 * (~±30) then encodes to ~248, inside the 1..255 byte range.
 */
const MEM_BIAS = 128;
const MEM_SCALE = 4;

export const Grid = {
    // TYPE
    getTypeAt(x: number, y: number): TElementType {
        return sandkit.api.elements.getResolvedTypeAtCell(x, y);
    },

    isEmptyAt(x: number, y: number): boolean {
        try {
            if (typeof sandkit.api.grid.isCellEmptyAtCell === "function") {
                return sandkit.api.grid.isCellEmptyAtCell!(x, y);
            }
        } catch {
            /* ignore */
        }
        const t = sandkit.api.elements.getTypeAtCell(x, y);
        return t == null || t === 0;
    },

    isTypeAt(
        x: number,
        y: number,
        includeType: TElementType[] | TElementType,
    ): boolean {
        const t = this.getTypeAt(x, y);
        if (t == null || t === 0) return false;
        const include = typeof includeType === "number" ? [includeType] : includeType;
        return include.includes(t);
    },

    isNotTypeAt(
        x: number,
        y: number,
        excludeTypes: TElementType[] | TElementType,
    ): boolean {
        if (Grid.isEmptyAt(x, y)) return true;
        const t = Grid.getTypeAt(x, y);
        if (t == null || t === 0) return true;
        const exclude = typeof excludeTypes === "number" ? [excludeTypes] : excludeTypes;
        return !exclude.includes(t);
    },

    // STRUCTURE
    hasStructureAt(x: number, y: number): boolean {
        try {
            const api = (sandkit as unknown as {
                api?: {
                    structures?: {
                        hasBuiltAtCell?: (x: number, y: number) => boolean;
                        getAtCell?: (x: number, y: number) => unknown;
                    };
                };
            }).api;
            const structures = api?.structures;
            if (typeof structures?.hasBuiltAtCell === "function") {
                return structures.hasBuiltAtCell(x, y) === true;
            }
            if (typeof structures?.getAtCell === "function") {
                return structures.getAtCell(x, y) != null;
            }
        } catch {
            /* ignore */
        }
        return false;
    },

    // DATA
    readFieldAt(x: number, y: number, field: number): number {
        try {
            const v = sandkit.api.elements.getDataFieldAtCell(x, y, field);
            return v == null || v < 0 ? 0 : v;
        } catch {
            return 0;
        }
    },
    /**
     * Raw field read that keeps negative values (the age reader clamps them
     * because the engine uses -1 as a sentinel). The vote-memory channel
     * stores signed vectors, so it must read through this.
     */
    readFieldRawAt(x: number, y: number, field: number): number {
        try {
            return sandkit.api.elements.getDataFieldAtCell(x, y, field) ?? 0;
        } catch {
            return 0;
        }
    },

    /**
     * Signed vector storage for the vote-memory channel.
     *
     * The engine's data fields cannot be relied on to hold negative numbers
     * (cell fields are typically unsigned bytes — a stored -2 comes back as
     * 0 or garbage, which silently erased every "up"/"left" velocity while
     * "down"/"right" survived). So vectors are encoded as
     * `round(v * MEM_SCALE) + MEM_BIAS`, clamped to 1..255. Raw `0` is
     * reserved for "no memory" — an encoded zero vector reads back as 128.
     * This round-trips correctly whether the field is a byte, int or float.
     */
    readVecAt(x: number, y: number, field: number): number {
        const raw = Grid.readFieldRawAt(x, y, field);
        if (raw <= 0) return 0; // unset / no memory
        return (raw - MEM_BIAS) / MEM_SCALE;
    },

    writeVecAt(x: number, y: number, field: number, v: number): void {
        const raw = Math.round(v * MEM_SCALE) + MEM_BIAS;
        Grid.writeFieldAt(x, y, field, raw < 1 ? 1 : raw > 255 ? 255 : raw);
    },

    writeFieldAt(x: number, y: number, field: number, value: number): void {
        try {
            sandkit.api.elements.setDataFieldAtCell(x, y, field, value);
        } catch {
            /* ignore */
        }
    },
    resetFieldAt(x: number, y: number, field: number): void {
        Grid.writeFieldAt(x, y, field, 0);
    },

    /**
     * Best-effort numeric type for "empty" used to clear eaten cells.
     * Probes common empty ids, falls back to 0 (universally empty).
     * Cached after first lookup.
     */
    emptyType(): TElementType {
        if (cachedEmpty != null) return cachedEmpty;
        const ids = ["empty", "Empty", "air", "Air", "void", "Void", "none", "None"];
        for (const id of ids) {
            try {
                const t = sandkit.api.elements.getTypeFromId(id);
                if (t != null) {
                    cachedEmpty = t;
                    return t;
                }
            } catch {
                /* try next */
            }
        }
        cachedEmpty = 0 as TElementType;
        return cachedEmpty;
    },

    // MOVE
    swapCell(
        x: number,
        y: number,
        nx: number,
        ny: number,
        passable: readonly TElementType[] | TElementType | null,
    ): { x: number; y: number } | null {
        const ok = passable == null ? [] : typeof passable === "number" ? [passable] : passable;
        const t = this.getTypeAt(nx, ny);
        if (t == null || !ok.includes(t)) return null;
        try {
            if (sandkit.api.elements.swapCells?.(x, y, nx, ny) === true) {
                return { x: nx, y: ny };
            }
        } catch {
            /* ignore */
        }
        try {
            if (sandkit.api.elements.moveBetweenCells?.(x, y, nx, ny) === true) {
                return { x: nx, y: ny };
            }
        } catch {
            /* ignore */
        }
        return null;
    },

    /**
     * Eat helper — replace whatever is at a cell with `replaceType`,
     * or clear to empty when `replaceType` is null.
     * Never touches the seed itself; caller must guard that.
     */
    eatAt(x: number, y: number, replaceType: TElementType | null): void {
        try {
            if (replaceType == null) {
                // No `removeAtCell` in the worker typings — clearing via
                // `replaceAtCell(emptyType)` is equivalent. `getTypeFromId`
                // probes common empty ids; falls back to 0 (empty).
                const empty = Grid.emptyType();
                if (empty != null) {
                    sandkit.api.elements.replaceAtCell(x, y, empty);
                }
            } else {
                sandkit.api.elements.replaceAtCell(x, y, replaceType);
            }
        } catch {
            /* ignore */
        }
    },

    /**
     * Pick a random 8-neighbour cell of (`x`,`y`) whose type is in
     * `matchTypes`. Returns null when none match.
     */
    randomNearCell(
        x: number,
        y: number,
        matchTypes: TElementType[] | TElementType,
    ): { x: number; y: number } | null {
        const match = typeof matchTypes === "number" ? [matchTypes] : matchTypes;
        // Fisher-Yates over the 8 offsets so the pick is uniform.
        const order = [0, 1, 2, 3, 4, 5, 6, 7];
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        for (const k of order) {
            const d = EAT_DELTAS[k];
            if (Grid.isTypeAt(x + d.x, y + d.y, match)) {
                return { x: x + d.x, y: y + d.y };
            }
        }
        return null;
    },
};

const EAT_DELTAS = [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
];
