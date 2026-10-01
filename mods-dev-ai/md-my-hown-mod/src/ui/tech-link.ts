

import { MOD_ID, type ModConfig, type TechConfig, type UnlockNodeConfig } from "../constants.ts";


export const DEFAULT_UNLOCK_NODE = `${MOD_ID}:unlock.default`;


export function defaultUnlockNode(): UnlockNodeConfig {
    return { id: DEFAULT_UNLOCK_NODE, name: "Unlock by default", kind: "always" };
}


export function allUnlockNodes(cfg: ModConfig): UnlockNodeConfig[] {
    const out = [defaultUnlockNode()];
    const seen = new Set([DEFAULT_UNLOCK_NODE]);
    for (const n of cfg.unlockNodes ?? []) {
        if (!n?.id || seen.has(n.id)) continue;
        seen.add(n.id);
        out.push(n);
    }
    return out;
}


export function unlockNodeOf(structureId: string, cfg: ModConfig): UnlockNodeConfig {
    const st = (cfg.structures ?? []).find((s) => s?.id === structureId);
    const want = st?.unlockNode?.trim();
    if (!want || want === DEFAULT_UNLOCK_NODE) return defaultUnlockNode();
    return (cfg.unlockNodes ?? []).find((n) => n?.id === want) ?? defaultUnlockNode();
}


export function isAlwaysUnlocked(structureId: string, cfg: ModConfig): boolean {
    return unlockNodeOf(structureId, cfg).kind === "always";
}


export function structuresForNode(nodeId: string, cfg: ModConfig): string[] {
    return (cfg.structures ?? [])
        .filter((s) => s?.id && unlockNodeOf(s.id, cfg).id === nodeId)
        .map((s) => s.id);
}


export function engineTechOf(node: UnlockNodeConfig, cfg: ModConfig): TechConfig | undefined {
    if (node.kind !== "tech") return undefined;
    if (node.techId) {
        
        
        
        
        return (cfg.techs ?? []).find((t) => t?.id === node.techId);
    }
    const built: TechConfig = {
        id: node.id,
        unlocks: { structures: structuresForNode(node.id, cfg) },
    };
    if (node.name) built.name = node.name;
    if (node.description) built.description = node.description;
    if (node.cost !== undefined) built.cost = node.cost;
    if (node.currencyType) built.currencyType = node.currencyType;
    if (node.branch) built.branch = node.branch;
    if (node.parentId) built.parentId = node.parentId;
    if (node.requires?.length) built.requires = node.requires;
    return built;
}


export function techUnlockStructureIds(techId: string, cfg: ModConfig): string[] {
    const tech = (cfg.techs ?? []).find((t) => t?.id === techId);
    const declared = Array.isArray(tech?.unlocks?.structures) ? tech.unlocks.structures : [];
    const out: string[] = [];
    const add = (id: unknown) => {
        if (typeof id === "string" && id && !out.includes(id)) out.push(id);
    };
    for (const id of declared) add(id);
    for (const n of cfg.unlockNodes ?? []) {
        if (!n?.id || n.kind !== "tech") continue;
        
        
        if (n.id === techId || n.techId === techId) {
            for (const id of structuresForNode(n.id, cfg)) add(id);
        }
    }
    return out;
}


export function describeNode(node: UnlockNodeConfig): string {
    const named = node.id === DEFAULT_UNLOCK_NODE ? "Unlock by default" : node.name || node.id;
    if (node.kind === "always") return `Available from the start — ${named}.`;

    const via = node.techId ? `via the engine tech ${node.techId}` : "as its own in-game tech node";
    const cost = node.cost === undefined ? "" : `, costs ${node.cost}`;
    const parent = node.parentId ? `, under ${node.parentId}` : "";
    return `Unlocked by ${named} ${via}${cost}${parent}.`;
}


export function unlockLine(
    form: Record<string, string>,
    cfg: ModConfig,
): string {
    const want = (form.unlockNode ?? "").trim();
    if (!want || want === DEFAULT_UNLOCK_NODE) return describeNode(defaultUnlockNode());
    const node = (cfg.unlockNodes ?? []).find((n) => n?.id === want);
    if (node) return describeNode(node);
    
    
    return `⚠ ${want} no longer exists — this structure is available from the start. ` +
        `Pick another node, or the default.`;
}
