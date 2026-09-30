/**
 * Spawn data handed off when buildAtCell cannot set custom data synchronously.
 * Key = `${cellX},${cellY}`.
 */
export interface PendingArtefactData {
    elementType: string;
    remaining: number;
    total: number;
    status: string;
    progress: number;
    max: number;
    /** Game tick / ms when registered — drop if never claimed. */
    at: number;
}

const pending = new Map<string, PendingArtefactData>();

export function setPendingArtefact(x: number, y: number, data: Omit<PendingArtefactData, "at">): void {
    pending.set(`${x},${y}`, { ...data, at: Date.now() });
}

export function takePendingArtefact(x: number, y: number): PendingArtefactData | null {
    const key = `${x},${y}`;
    const v = pending.get(key) ?? null;
    if (v) pending.delete(key);
    return v;
}

export function peekPendingArtefact(x: number, y: number): PendingArtefactData | null {
    return pending.get(`${x},${y}`) ?? null;
}
