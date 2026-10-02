import { JsonMapBuffer } from "@sandmd/buffer";
import type { BufferEntryConfig, BufferValueType } from "../../constants.ts";

interface BufferProblem {
    id: string;
    path: string;
    reason: string;
}

const PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/;

export function zeroFor(type: BufferValueType): number | boolean | string {
    return type === "number" ? 0 : type === "bool" ? false : "";
}

function coerceDefault(type: BufferValueType, raw: unknown): number | boolean | string {
    if (type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "bool") {
        if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
        return Boolean(raw);
    }
    return raw == null ? "" : String(raw);
}

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

function planSlot(entry: BufferEntryConfig): SlotPlan {
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

interface BufferHandle {
    getPath(path: string): unknown;
    setPath(path: string, value: unknown): void;
    increment(path: string, delta: number): number;
    isCounter(path: string): boolean;
    commit(): void;
}

function build(entries: readonly BufferEntryConfig[]): {
    buffer: BufferHandle | null;
    problems: BufferProblem[];
} {
    const problems: BufferProblem[] = [];
    const defaultRecord: Record<string, unknown> = {};
    const counters: Record<string, { min: number; max: number }> = {};

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
            problems.push({
                id: entry.id,
                path,
                reason: `already declared by "${first}" — two slots cannot share a path`,
            });
            continue;
        }
        claimed.set(path, entry.id);

        setDeep(defaultRecord, path, plan.value);
        if (plan.bounds) counters[path] = plan.bounds;
    }

    if (Object.keys(defaultRecord).length === 0) {
        return { buffer: null, problems };
    }

    try {
        const buffer = new JsonMapBuffer({
            key: "mdBuffers",
            defaultRecord,

            maxBytes: 64 * 1024,
            counters,

            persist: false,
            loadFromStorage: false,
        });
        return { buffer, problems };
    } catch (e) {
        problems.push({
            id: "*",
            path: "",
            reason: `the shared buffer could not be created: ${(e as Error).message}`,
        });
        return { buffer: null, problems };
    }
}

function setDeep(target: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(/\.|\[(\d+)\]/).filter((p) => p !== undefined && p !== "");
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const isIndex = /^\d+$/.test(part);
        const key = isIndex ? Number(part) : part;
        const next = node[key as string];
        if (next == null || typeof next !== "object") {
            node[key as string] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }
        node = node[key as string] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
}

/**
 * The shared buffer, built once from the declared entries.
 *
 * `resetBuffer` drops it so the next `ensureBufferReady` rebuilds from a
 * reloaded config; the action that owns the buffer calls it on every reload.
 * Build problems are reported per-slot by the action itself, so they are not
 * retained here.
 */
let live: BufferHandle | null = null;
let liveBuilt = false;

export function ensureBufferReady(
    entries: readonly BufferEntryConfig[],
): BufferHandle | null {
    if (liveBuilt) return live;
    live = build(entries).buffer;
    liveBuilt = true;
    return live;
}

export function resetBuffer(): void {
    live = null;
    liveBuilt = false;
}
