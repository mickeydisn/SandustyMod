/**
 * Resolve actif / action against a JsonMapBuffer.
 *
 * Per-cell mode: action is applied with delta = processed cell count
 * (caller passes the count into runAction).
 */
import type {
    ProcessActif,
    ProcessAction,
    ProcessMapBuffer,
} from "./types.ts";

export function resolveActif(
    actif: ProcessActif,
    map: ProcessMapBuffer,
): () => boolean {
    if (typeof actif === "function") return actif;
    const { path, op } = actif;
    if (op === "always") return () => true;
    return () => {
        const v = map.getPath(path);
        return typeof v === "number" && v > 0;
    };
}

/**
 * Run action after cells were processed.
 * - function action: called once, ignore count
 * - { path, op }: increment by ±count (one cell = one step)
 * Returns true if the buffer changed (or function returned true).
 */
export function runAction(
    action: ProcessAction,
    map: ProcessMapBuffer,
    processedCount: number,
): boolean {
    if (processedCount <= 0 && typeof action !== "function") return false;

    if (typeof action === "function") {
        try {
            return action();
        } catch {
            return false;
        }
    }

    const { path, op } = action;
    const sign = op === "dec" || op === "decX" ? -1 : 1;
    // incX / decX still mean "larger step" per cell if desired later;
    // for now one cell = one unit regardless of X suffix.
    const delta = sign * processedCount;

    try {
        const before = map.getPath(path);
        const after = map.increment(path, delta);
        if (typeof before === "number" && typeof after === "number") {
            return after !== before;
        }
        return true;
    } catch {
        return false;
    }
}

export function readCounter(map: ProcessMapBuffer, path: string): number {
    const v = map.getPath(path);
    return typeof v === "number" ? v : 0;
}

export function actionPath(action: ProcessAction): string | null {
    if (typeof action === "function") return null;
    return action.path ?? null;
}
