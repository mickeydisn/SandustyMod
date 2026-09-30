/**
 * Best-effort element helpers (type resolve, presence, remove, create).
 * Mirrors patterns used in md-buffer-process.
 */
import "@sandmd/sandkit";

export function resolveElementType(elm: string | null | undefined): number | null {
    if (!elm) return null;
    const api = sandkit.api;
    try {
        const t =
            api.elements.getTypeFromId?.(elm) ??
            api.elements.getTypeById?.(elm);
        return typeof t === "number" ? t : null;
    } catch {
        return null;
    }
}

export function cellHasElement(
    x: number,
    y: number,
    elmType: number,
    elmId: string,
): boolean {
    const api = sandkit.api;
    try {
        if (api.elements.isTypeAtCell?.(x, y, elmId)) return true;
        if (api.elements.isTypeAtCell?.(x, y, elmType)) return true;
    } catch { /* fall through */ }
    try {
        const t = api.elements.getTypeAtCell?.(x, y);
        if (t === elmType) return true;
        const resolved = api.elements.getResolvedTypeAtCell?.(x, y);
        if (resolved === elmType) return true;
    } catch { /* best-effort */ }
    return false;
}

export function removeElementAt(x: number, y: number): void {
    const api = sandkit.api;
    try {
        if (typeof api.elements.removeAtCellWhenIdle === "function") {
            api.elements.removeAtCellWhenIdle(x, y);
            return;
        }
    } catch { /* fall through */ }
    try {
        api.elements.removeAtCell?.(x, y);
    } catch { /* best-effort */ }
}

export function createElementAt(x: number, y: number, elmType: number): void {
    const api = sandkit.api;
    try {
        if (typeof api.elements.createAtCellWhenIdle === "function") {
            api.elements.createAtCellWhenIdle(x, y, elmType);
            return;
        }
    } catch { /* fall through */ }
    try {
        api.elements.createAtCell?.(x, y, elmType);
    } catch { /* best-effort */ }
}

export function isCellEmpty(x: number, y: number): boolean {
    const api = sandkit.api;
    try {
        if (typeof api.grid?.isCellEmptyAtCell === "function") {
            return api.grid.isCellEmptyAtCell(x, y);
        }
    } catch { /* fall through */ }
    try {
        const t = api.elements.getTypeAtCell?.(x, y);
        return t === null || t === undefined || t === 0;
    } catch {
        return true;
    }
}

/** Clear all elements inside a circular radius (euclidean). */
export function clearCircle(cx: number, cy: number, radius: number): number {
    let removed = 0;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (isCellEmpty(x, y)) continue;
            removeElementAt(x, y);
            removed++;
        }
    }
    return removed;
}
