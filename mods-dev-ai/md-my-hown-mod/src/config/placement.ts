
import type { PlacementConfigConfig, PlacementFieldConfig } from "../constants.ts";


export function hasPlacementLabel(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const o = v as { label?: unknown; labelKey?: unknown };
    const text = (x: unknown): boolean => typeof x === "string" && x.trim().length > 0;
    return text(o.label) || text(o.labelKey);
}


export function placementConfigProblem(
    def: Partial<PlacementConfigConfig> | null | undefined,
): string | null {
    if (!def) return "no placement config";
    const id = typeof def.structureId === "string" ? def.structureId.trim() : "";
    const fields = def.fields;
    if (!id || !Array.isArray(fields) || fields.length === 0) {
        return "Placement config requires a structureId and fields.";
    }
    const seen = new Set<string>();
    for (const f of fields as PlacementFieldConfig[]) {
        const fid = typeof f?.id === "string" ? f.id.trim() : "";
        if (!fid || !hasPlacementLabel(f) || seen.has(fid)) {
            
            
            
            
            
            return `Invalid or duplicate placement field "${f?.id}".`;
        }
        seen.add(fid);
        const type = f?.type;
        if (type !== "integer" && type !== "choice") {
            
            
            return `Placement field "${fid}" has type "${
                String(type)
            }" — expected integer or choice.`;
        }
        if (type === "choice") {
            const opts = (f as { options?: unknown }).options;
            if (!Array.isArray(opts) || opts.length === 0) {
                return `Placement choice "${fid}" requires at least one option.`;
            }
            for (const o of opts) {
                if (!hasPlacementLabel(o)) {
                    return `Placement choice "${fid}" has an option without a label.`;
                }
            }
        }
    }
    return null;
}


export function placementConfigPayload(
    def: PlacementConfigConfig,
): { structureId: string; fields: PlacementFieldConfig[] } {
    return { structureId: def.structureId, fields: def.fields };
}
