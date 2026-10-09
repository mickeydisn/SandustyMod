import { g } from "../host.ts";
import { elements } from "../api/elements.ts";
import type {
    ElementId,
    ElementRef,
    ItemType,
    StructureRef,
    StructureType,
    TerrainRef,
    TerrainType,
} from "../host-types/domain.d.ts";

/**
 * Resolve an element ref to its numeric type where the host knows the id.
 *
 * Unknown string ids pass through unchanged so mod-defined elements registered
 * after this call still work — the host resolves them again on its side.
 */
export function resolveElementRef(
    v: ElementRef | null | undefined,
): ElementRef | null | undefined {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v;
    const t = elements.getTypeById?.(v as ElementId);
    return t !== undefined ? t : v;
}

/** Resolve a structure id to its numeric type via `sandkit.enums.StructureType`. */
export function resolveStructureType(v: StructureRef): StructureRef {
    if (typeof v === "number") return v as StructureType;
    const enums = g()?.enums?.StructureType as Record<string, StructureType> | undefined;
    if (enums && typeof v === "string" && v in enums) return enums[v];
    return v;
}

/** Resolve a terrain id to its numeric cell type, passing unknown ids through. */
export function resolveTerrainRef(
    v: TerrainRef | null | undefined,
): TerrainRef | null | undefined {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v as TerrainType;
    const t = g()?.api?.terrains?.getTypeById?.(v) as TerrainType | undefined;
    return t !== undefined && t !== null ? t : v;
}

/**
 * Resolve an item category to its numeric handle.
 *
 * Falls back to `Mod` so an unregistered category never becomes `undefined`
 * on the wire.
 */
export function resolveItemType(v: string | number | undefined): ItemType {
    if (typeof v === "number") return v as ItemType;
    const enums = g()?.enums?.ItemType as Record<string, ItemType> | undefined;
    if (typeof v === "string" && enums) {
        if (v in enums) return enums[v];
        const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        if (cap in enums) return enums[cap];
    }
    return (enums?.Mod ?? "Mod") as ItemType;
}

/** True when the category is the host's `Consumable`. */
export function isConsumableType(v: string | number | undefined): boolean {
    if (v === "Consumable" || v === "consumable") return true;
    if (typeof v === "number") {
        return v === (g()?.enums?.ItemType as Record<string, number> | undefined)?.Consumable;
    }
    return false;
}
