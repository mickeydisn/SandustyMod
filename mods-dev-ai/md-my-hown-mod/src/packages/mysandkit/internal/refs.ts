import { g } from "../host.ts";
import { elements } from "../api/elements.ts";

export function resolveElementRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null) return null;
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const t = elements.getTypeById?.(v);
        return t !== undefined ? t : v;
    }
    return v;
}

export function resolveStructureType(v: string | number): string | number {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.StructureType;
    if (typeof v === "string" && enums && v in enums) return enums[v];
    return v;
}

export function resolveTerrainRef(
    v: string | number | null | undefined,
): string | number | null | undefined {
    if (v === null || v === undefined) return v;
    if (typeof v === "number") return v;
    const t = g()?.api?.terrains?.getTypeById?.(v);
    return t !== undefined && t !== null ? t : v;
}

export function resolveItemType(v: string | number | undefined): number | string {
    if (typeof v === "number") return v;
    const enums = g()?.enums?.ItemType;
    if (typeof v === "string" && enums) {
        if (v in enums) return enums[v];
        const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        if (cap in enums) return enums[cap];
    }
    return enums?.Mod ?? "Mod";
}

export function isConsumableType(v: string | number | undefined): boolean {
    if (v === "Consumable" || v === "consumable") return true;
    if (typeof v === "number") return v === g()?.enums?.ItemType?.Consumable;
    return false;
}
