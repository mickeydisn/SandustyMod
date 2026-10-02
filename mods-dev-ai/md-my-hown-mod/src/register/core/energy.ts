import { LOG } from "../../constants.ts";
import { api, resolveElementRef, resolveTerrainRef } from "../../packages/mysandkit.ts";
import { compileExcavationProfile } from "../../handler/processing/excavation-option/index.ts";
import { ENERGY_ROLES, isOneOf } from "../../ui/definition/choices.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerEnergyTypes({ config }: RegisterContext): number {
    return registerEach(config.energyTypes, "energyTypes", (def) => {
        try {
            const type = def.type;
            if (!isOneOf(ENERGY_ROLES, type)) {
                console.warn(
                    `${LOG} energy ${def.id}: invalid type "${String(type)}" ` +
                        `— must be conductor|storage. Skip.`,
                );
                return;
            }
            api.energy.registerType(
                def.structureId,
                type as "conductor" | "storage",
                def.options ?? {},
            );
        } catch (e) {
            console.error(`${LOG} energy.registerType failed`, def.id, e);
        }
    });
}

export function registerExcavationProfiles({ config }: RegisterContext): number {
    return registerEach(config.excavationProfiles, "excavationProfiles", (def) => {
        try {
            const { id, power, pattern, options, terrainRules } = def as typeof def & {
                terrainRules?: unknown;
            };

            const { patch, key, problem } = compileExcavationProfile(
                def as Record<string, unknown>,
            );
            if (problem) {
                console.warn(
                    `${LOG} excavation profile ${id}: ${problem} — using the stored power`,
                );
            } else if (key) {
                console.log(`${LOG} excavation profile ${id}: power and flags from ${key}`);
            }

            const payload: Record<string, unknown> = {
                power: patch.power ?? power,
                options: patch.options ?? options,
                pattern,
            };
            if (Array.isArray(terrainRules) && terrainRules.length > 0) {
                payload.terrainRules = terrainRules.map(terrainRule);
            }
            api.excavation.registerProfile(id, payload);
        } catch (e) {
            console.error(`${LOG} excavation.registerProfile failed`, def.id, e);
        }
    });
}

function terrainRule(raw: unknown): Record<string, unknown> {
    const r = (raw ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const cellType = resolveTerrainRef(
        (r.cellType ?? r.terrainType) as string | number | undefined,
    );
    if (cellType !== undefined && cellType !== null) out.cellType = cellType;
    if (r.damage !== undefined) out.damage = r.damage;
    const el = resolveElementRef(r.outputElementType as string | number | undefined);
    if (el !== undefined && el !== null) out.outputElementType = el;
    return out;
}
