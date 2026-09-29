/**
 * The live shared buffer, built from the author's Buffer slots.
 *
 * ## Why this is not just "call the package"
 *
 * `JsonMapBuffer` wants a `counters` map and a `defaultRecord` that agree
 * exactly: every mapped path must exist in the record, and every numeric path
 * needs integer bounds or the constructor throws. That is a *derived* shape — it
 * falls out of the author's list of slots and is never written by hand. So the
 * translation lives here, once, instead of being re-derived at three call sites
 * that could disagree about what a missing bound means.
 *
 * ## The two kinds of slot
 *
 * A **number** slot is a mapped atomic counter: clamped, cross-thread, and
 * `increment`-able, which is the whole reason to use `JsonMapBuffer` over
 * `JsonBuffer`. It needs `min`/`max`, and its values must be integers.
 *
 * A **bool** or **string** slot has no atomic counterpart, so it lives in the
 * JSON payload and is read and written with `getPath`/`setPath` like any other
 * field. Declaring one as a counter is not possible, and pretending otherwise
 * would mean clamping a string.
 *
 * ## Failure is reported, never thrown
 *
 * A slot with a missing bound, a duplicate path, or a default that does not
 * match its type is a *panel* mistake, and the author is standing in the panel
 * when they can fix it. So `build` skips the offending slot and returns the
 * reason alongside the buffer, and the panel shows it next to the row. Throwing
 * here would take down every action in the mod over one bad row.
 *
 * @module
 */
import { JsonMapBuffer } from "@sandmd/buffer";
import type { BufferEntryConfig, BufferValueType } from "../constants.ts";

/** A slot that could not be used, and why. Shown beside its row. */
export interface BufferProblem {
    id: string;
    path: string;
    reason: string;
}

/** The path syntax the buffer reads: `counters.digs`, `players[0].score`. */
const PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/;

/** The zero of a type — what a missing value reads back as. */
export function zeroFor(type: BufferValueType): number | boolean | string {
    return type === "number" ? 0 : type === "bool" ? false : "";
}

/**
 * Force a stored default into the shape its declared type promises.
 *
 * The form stores every field as text, so `"0"` and `"false"` are what actually
 * arrive. Coercing here rather than at each use means a slot behaves the same
 * whether it was saved by the panel, by a hand-edited config, or by a migration.
 */
export function coerceDefault(type: BufferValueType, raw: unknown): number | boolean | string {
    if (type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "bool") {
        // `Boolean("false")` is `true`, which is the bug this guards: the string
        // "false" is what a text field actually stores.
        if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
        return Boolean(raw);
    }
    return raw == null ? "" : String(raw);
}

/** What one slot contributes to the constructor's derived arguments. */
interface SlotPlan {
    entry: BufferEntryConfig;
    value: number | boolean | string;
    bounds: { min: number; max: number } | null;
    problem: string | null;
}

function fail(entry: BufferEntryConfig, path: string, reason: string): SlotPlan {
    return {
        entry,
        value: zeroFor((entry.type as BufferValueType) ?? "number"),
        bounds: null,
        problem: reason,
    };
}

/**
 * Check one slot and decide what it maps to.
 *
 * Split out from `build` so the panel can validate a *form* — before the entry
 * is saved and therefore before the buffer exists — with exactly the rules the
 * constructor will apply. Two validators is how a slot gets saved that the
 * constructor then refuses.
 */
export function planSlot(entry: BufferEntryConfig): SlotPlan {
    const path = String(entry.path ?? "").trim();
    if (!path) return fail(entry, path, "a path is required");
    if (!PATH_RE.test(path)) {
        return fail(entry, path, "not a path — use `counters.digs` or `players[0].score`");
    }
    const type = entry.type;
    if (type !== "number" && type !== "bool" && type !== "string") {
        return fail(entry, path, `unknown type "${String(type)}"`);
    }

    const value = coerceDefault(type, entry.default);

    if (type !== "number") {
        return { entry, value, bounds: null, problem: null };
    }

    // Numeric slots are atomic counters, and a counter without both bounds has
    // nothing to clamp to. Defaulting them here would invent a range the author
    // never chose, and the clamp is what stops a runaway increment.
    const min = Number(entry.min);
    const max = Number(entry.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return fail(entry, path, "a number needs both a min and a max — it is clamped to them");
    }
    if (min > max) {
        return fail(entry, path, `min (${min}) is above max (${max})`);
    }
    if (!Number.isInteger(value)) {
        return fail(
            entry,
            path,
            `default must be a whole number — the slot is an integer counter`,
        );
    }
    return { entry, value, bounds: { min, max }, problem: null };
}

/** The buffer handle the actions talk to. Narrowed to what they actually call. */
export interface BufferHandle {
    getPath(path: string): unknown;
    setPath(path: string, value: unknown): void;
    increment(path: string, delta: number): number;
    isCounter(path: string): boolean;
    commit(): void;
}

// `Boolean("false")` is `true`, which is the bug this guards: the string

/**
 * Build the shared buffer from the author's slots.
 *
 * Returns `buffer: null` when there is nothing usable, which is the common case
 * — a mod with no buffer slots has no buffer. The actions treat that the same as
 * an empty buffer: a read gives the type's zero, a write is dropped.
 */
export function build(entries: readonly BufferEntryConfig[]): {
    buffer: BufferHandle | null;
    problems: BufferProblem[];
} {
    const problems: BufferProblem[] = [];
    const defaultRecord: Record<string, unknown> = {};
    const counters: Record<string, { min: number; max: number }> = {};
    /** path → the id that claimed it, so a duplicate can name the first claimant. */
    const claimed = new Map<string, string>();

    for (const entry of entries ?? []) {
        const plan = planSlot(entry);
        if (plan.problem) {
            problems.push({
                id: entry.id,
                path: String(entry.path ?? ""),
                reason: plan.problem,
            });
            continue;
        }
        const path = String(entry.path).trim();
        const first = claimed.get(path);
        if (first) {
            // Two slots on one path is not a merge: the second would silently
            // overwrite the first's default and bounds, and which one won would
            // depend on list order.
            problems.push({
                id: entry.id,
                path,
                reason: `already declared by "${first}" — two slots cannot share a path`,
            });
            continue;
        }
        claimed.set(path, entry.id);
        // Writing into the bare record is what materialises the nested
        // containers, so a dotted path lands as a real object rather than a key
        // with a dot in it.
        setDeep(defaultRecord, path, plan.value);
        if (plan.bounds) counters[path] = plan.bounds;
    }

    if (Object.keys(defaultRecord).length === 0) {
        return { buffer: null, problems };
    }

    try {
        const buffer = new JsonMapBuffer({
            // One key for the whole mod: the slots are the author's, and a
            // per-slot key would mean a shared buffer per row for no gain.
            key: "mdBuffers",
            defaultRecord,
            // 64 KB is far above what a config of text rows can need, and the
            // slot is allocated once at boot rather than per write.
            maxBytes: 64 * 1024,
            counters,
            // The world save already carries the config, so persistence is off:
            // these are run-time values, and saving them would make a stale
            // counter look like authored state on the next load.
            persist: false,
            loadFromStorage: false,
        });
        return { buffer, problems };
    } catch (e) {
        // The constructor throws on a malformed counters map. Every row was
        // planned above, so this is the engine disagreeing with us; report it
        // rather than taking the mod down.
        problems.push({
            id: "*",
            path: "",
            reason: `the shared buffer could not be created: ${(e as Error).message}`,
        });
        return { buffer: null, problems };
    }
}

/**
 * Write `value` at `path`, creating the containers on the way.
 *
 * Local copy rather than the package's `setPath`, because this runs against a
 * plain object literal while the record is being *built* — before any buffer
 * exists — and the package's helper expects a live buffer.
 */
function setDeep(target: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(/\.|\[(\d+)\]/).filter((p) => p !== undefined && p !== "");
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const isIndex = /^\d+$/.test(part);
        const key = isIndex ? Number(part) : part;
        const next = node[key as string];
        if (next == null || typeof next !== "object") {
            // The next segment decides the container: `[0]` means an array.
            node[key as string] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        node = node[key as string] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
}

/**
 * The live buffer, built once from the saved slots.
 *
 * A module-level singleton, which `context.ts` argues against for *per-run*
 * state and which is right here: the shared buffer is not per-run. It is the
 * mod's, it lives in shared memory, and the whole point is that two structures on
 * two threads see the same slot. One instance per module is what makes that
 * work — two would each hold their own cache and disagree.
 *
 * Null until `ensureBufferReady()` runs, and null forever if there are no usable
 * slots. Both are the same case to a caller: there is nothing to read or write.
 */
let live: BufferHandle | null = null;
let liveBuilt = false;
let liveProblems: BufferProblem[] = [];

/**
 * Build the live buffer if it is not built yet.
 *
 * Idempotent, and called lazily by the actions rather than at boot, because a
 * mod that declares no buffer slots should not allocate shared memory it will
 * never touch. Returns the handle, or `null`.
 */
export function ensureBufferReady(
    entries: readonly BufferEntryConfig[],
): BufferHandle | null {
    if (liveBuilt) return live;
    const { buffer, problems } = build(entries);
    live = buffer;
    liveProblems = problems;
    liveBuilt = true;
    return live;
}

/** Forget the built buffer, so the next action rebuilds it. For tests and reloads. */
export function resetBuffer(): void {
    live = null;
    liveBuilt = false;
    liveProblems = [];
}

/** The slots that could not be used, for the panel to show beside their rows. */
export function bufferProblems(): BufferProblem[] {
    return liveProblems;
}

/** The handle, without building. Null before the first action runs. */
export function currentBuffer(): BufferHandle | null {
    return live;
}
