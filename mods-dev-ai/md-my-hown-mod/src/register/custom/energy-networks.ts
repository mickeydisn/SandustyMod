import { LOG, type ModConfig } from "../../constants.ts";
import type { RegisterContext } from "../registry.ts";

function joinedNetworkNames(config: ModConfig): Set<string> {
    const out = new Set<string>();
    for (const e of config.energyTypes ?? []) {
        const name = e?.options?.energyType;
        if (typeof name === "string" && name) out.add(name);
    }
    for (const s of config.structures ?? []) {
        const name = (s as { energyType?: unknown } | null)?.energyType;
        if (typeof name === "string" && name) out.add(name);
    }
    return out;
}

/** Reports declared energy networks that nothing joins. Never registers. */
export function reportEnergyNetworks({ config }: RegisterContext): number {
    const joined = joinedNetworkNames(config);
    const declared = (config.energyNetworks ?? [])
        .map((e) => (typeof e?.id === "string" ? e.id : ""))
        .filter((id) => id && !joined.has(id));
    if (!declared.length) return 0;

    console.warn(
        `${LOG} energy networks declared but never joined: ${declared.join(", ")}. ` +
            `The engine finds a network by walking connected tiles, so a name nothing ` +
            `refers to cannot affect the simulation. Point some energy entries at it, ` +
            `or delete it.`,
    );
    return 0;
}