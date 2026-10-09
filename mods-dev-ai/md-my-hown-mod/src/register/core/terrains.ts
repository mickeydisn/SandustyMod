import { LOG } from "../../constants.ts";
import { api, resolveElementRef } from "../../packages/mysandkit.ts";
import type {
    ElementType,
    Interaction,
    TerrainColorPattern,
    TerrainDefinition,
} from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

/** Resolve one optional element ref slot to a numeric handle. */
function slot(value: string | number | null | undefined): ElementType | undefined {
    if (value === null || value === undefined) return undefined;
    return resolveElementRef(value) as ElementType;
}

export function registerTerrains({ config }: RegisterContext): number {
    return registerEach(config.terrains, "terrains", (def) => {
        try {
            const id = String(def.id);
            // dropped from the spread and re-validated below: the config types
            // these loosely (number[] / unknown[]) but the host wants exact
            // shapes, so a bad value from a hand-written config must not reach it
            const {
                colorHSL,
                interactions,
                output,
                backgroundElementType,
                fogElementType,
                colorPattern,
                colorGradient,
                ...rest
            } = def;
            const out: TerrainDefinition = { ...rest, id };
            if (def.name && !def.nameKey) out.nameKey = `terrains|${id}|name`;

            // the host needs exactly 3 HSL components
            if (colorHSL) {
                if (colorHSL.length !== 3) {
                    console.warn(
                        `${LOG} terrain ${id}: colorHSL needs 3 components, got ${colorHSL.length}`,
                    );
                } else {
                    const [h, s, l] = colorHSL as number[];
                    out.colorHSL = [h, s, l];
                }
            }

            if (Array.isArray(interactions)) {
                out.interactions = interactions as Interaction[];
            }

            // `size` is [width, height] and each pattern cell is RGBA, so both
            // are narrowed here rather than shipped as loose arrays
            if (colorPattern) {
                const size = colorPattern.size;
                const pattern: TerrainColorPattern = {};
                if (size) {
                    if (size.length === 2) {
                        pattern.size = [size[0], size[1]];
                    } else {
                        console.warn(
                            `${LOG} terrain ${id}: colorPattern.size needs 2 components, got ${size.length}`,
                        );
                    }
                }
                const grid = colorPattern.colorsHSL;
                if (grid) {
                    pattern.colorsHSL = grid.map((row) =>
                        row.map((cell) => {
                            const c = Array.isArray(cell) ? cell : [];
                            const [r, g, b, a = 255] = c as number[];
                            return [r ?? 0, g ?? 0, b ?? 0, a] as const;
                        })
                    );
                }
                out.colorPattern = pattern;
            }

            if (colorGradient) {
                const stops = (colorGradient.stops ?? []).map((stop) => {
                    const c = stop.color;
                    const rgb: [number, number, number] = Array.isArray(c) && c.length === 3
                        ? [c[0] as number, c[1] as number, c[2] as number]
                        : [0, 0, 0];
                    return { hp: stop.hp, color: rgb };
                });
                out.colorGradient = { stops };
            }

            // Element slots are ids in the config but resolved numeric handles
            // in the host, so resolve them here instead of shipping strings the
            // engine would not look up. `output.elementType: null` is a real
            // case meaning "drops nothing", so it is preserved rather than
            // treated as missing.
            const bg = slot(backgroundElementType);
            if (bg !== undefined) out.backgroundElementType = bg;
            const fogEl = slot(fogElementType);
            if (fogEl !== undefined) out.fogElementType = fogEl;

            // The host throws for an out-of-range materialId (bundel.js
            // 50040-50046): it must be a number greater than
            // `obstacleBreakpoint` (100) and below 150.
            const mat = rest.materialId;
            if (mat !== undefined) {
                if (typeof mat !== "number" || mat <= 100 || mat >= 150) {
                    console.warn(
                        `${LOG} terrain ${id}: materialId must be a number in 101-149, got ${
                            String(mat)
                        }. Skipping.`,
                    );
                    return;
                }
            }

            if (output) {
                if (output.elementType === null) {
                    out.output = { elementType: null, chance: output.chance ?? 1 };
                } else if (output.elementType !== undefined) {
                    out.output = {
                        elementType: resolveElementRef(output.elementType) as ElementType,
                        chance: output.chance ?? 1,
                    };
                } else {
                    console.warn(`${LOG} terrain ${id}: output without elementType`);
                }
            }

            api.terrains.register(out);
        } catch (e) {
            console.error(`${LOG} terrains.register failed`, def.id, e);
        }
    });
}
