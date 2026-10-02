import type { PlacementConfigConfig, PlacementFieldConfig } from "../constants.ts";

/**
 * A problem in a placement config, paired with the field it belongs to. Carrying
 * the field lets a form put the message on the right input instead of matching
 * on the message text.
 */
export interface PlacementProblem {
    /** The config key the problem belongs to. */
    readonly field: "structureId" | "fields";
    readonly message: string;
}

/** True when `v` carries a `label` or `labelKey` with text in it. */
function hasLabel(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const o = v as { label?: unknown; labelKey?: unknown };
    const text = (x: unknown): boolean => typeof x === "string" && x.trim().length > 0;
    return text(o.label) || text(o.labelKey);
}

/**
 * The first problem that would stop `def` registering, or null if it is fine.
 * Only reads `structureId` and `fields`, so a form can pass a half-built object.
 */
export function placementConfigProblem(
    def: { structureId?: unknown; fields?: unknown } | null | undefined,
): PlacementProblem | null {
    const id = typeof def?.structureId === "string" ? def.structureId.trim() : "";
    if (!def || !id) return { field: "structureId", message: "requires a structureId" };

    const fields = def.fields;
    if (!Array.isArray(fields) || fields.length === 0) {
        return { field: "fields", message: "requires at least one field" };
    }

    const seen = new Set<string>();
    for (const f of fields as PlacementFieldConfig[]) {
        const fid = typeof f?.id === "string" ? f.id.trim() : "";
        if (!fid || !hasLabel(f) || seen.has(fid)) {
            return { field: "fields", message: `invalid or duplicate field "${f?.id}"` };
        }
        seen.add(fid);

        const type = f?.type;
        if (type !== "integer" && type !== "choice") {
            return {
                field: "fields",
                message: `field "${fid}" has type "${String(type)}" — expected integer or choice`,
            };
        }
        if (type === "choice") {
            const opts = (f as { options?: unknown }).options;
            if (!Array.isArray(opts) || opts.length === 0) {
                return { field: "fields", message: `choice "${fid}" needs at least one option` };
            }
            for (const o of opts) {
                if (!hasLabel(o)) {
                    return { field: "fields", message: `choice "${fid}" has an option with no label` };
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
