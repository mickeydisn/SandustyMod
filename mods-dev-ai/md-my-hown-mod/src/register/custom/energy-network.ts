import { LOG, type ModConfig } from "../../constants.ts";
import { customIds } from "./index.ts";

export function joinedNetworkNames(config: ModConfig): Set<string> {
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

export function unusedEnergyNetworks(
    config: ModConfig,
    joined: ReadonlySet<string>,
): string[] {
    return [...customIds("energyNetworks", config)].filter((id) => !joined.has(id));
}

export function reportEnergyNetworks(
    config: ModConfig,
    joined: ReadonlySet<string>,
): void {
    const unused = unusedEnergyNetworks(config, joined);
    if (!unused.length) return;
    console.warn(
        `${LOG} energy networks declared but never joined: ${unused.join(", ")}. ` +
            `The engine finds a network by walking connected tiles, so a name nothing ` +
            `refers to cannot affect the simulation. Point some energy entries at it, ` +
            `or delete it.`,
    );
}
