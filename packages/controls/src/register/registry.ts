import type { StructureLike } from "../types.ts";

/**
 * Tracks which placed structure currently owns an exclusive choice (one active
 * state on a `Selector`). A config path can only have a single exclusive owner.
 * Shared by the per-item register functions and `ControlSystem`.
 */
export class ControlRegistry {
    private exclusiveOwners = new Map<string, StructureLike>();

    claimExclusive(path: string, structure: StructureLike): void {
        this.exclusiveOwners.set(path, structure);
    }

    isExclusiveOwner(path: string, structure: StructureLike): boolean {
        const owner = this.exclusiveOwners.get(path);
        return !!owner && owner.x === structure.x && owner.y === structure.y;
    }

    clearExclusive(path: string): void {
        this.exclusiveOwners.delete(path);
    }
}