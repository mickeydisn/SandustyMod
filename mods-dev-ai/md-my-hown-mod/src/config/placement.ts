import type { PlacementConfigConfig, PlacementFieldConfig } from "../constants.ts";
import type { PlacementConfigDefinition } from "../packages/mysandkit.ts";

export interface PlacementProblem {
    readonly field: "structureId" | "fields";
    readonly message: string;
}

function hasLabel(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const o = v as { label?: unknown; labelKey?: unknown };
    const text = (x: unknown): boolean => typeof x === "string" && x.trim().length > 0;
    return text(o.label) || text(o.labelKey);
}

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
                    return {
                        field: "fields",
                        message: `choice "${fid}" has an option with no label`,
                    };
                }
            }
        }
    }
    return null;
}

/**
 * Narrowed payload handed to the host.
 *
 * Only reached after {@link placementConfigProblem} has passed, so the
 * discriminated field union holds — this is what turns the engine's
 * runtime throws into compile-time guarantees.
 */
export function placementConfigPayload(
    def: PlacementConfigConfig,
): PlacementConfigDefinition {
    return { structureId: def.structureId, fields: def.fields } as PlacementConfigDefinition;
}
