/**
 * Resolve a parameter that may be a plain number or a zero-arg accessor.
 * Used by every action builder so profiles can pass either literals or live
 * config readers without callers branching on the type.
 */
export function resolveNum(v: number | (() => number), fallback = 0): number {
    if (typeof v === "function") return v();
    if (v === undefined || v === null) return fallback;
    return v;
}
