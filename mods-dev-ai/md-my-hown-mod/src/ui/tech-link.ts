/**
 * Structures and their unlock node, and how that becomes an in-game tech node.
 *
 * **Why a separate kind of node.** The engine reads a structure's unlock from
 * one place only: the *tech* side, `tech.unlocks.structures`, granted when the
 * node is researched (bundel.js 77135.js — `fe` pushes into `player.buildings`,
 * the list the build menu reads). That works, but it leaves a mod with two
 * questions — "what is this structure gated behind?" and "what does my tech tree
 * look like?" — answered on two different screens, and the only way to say
 * "available from the start" was to leave the field empty and hope.
 *
 * An **unlock node** collapses that. It is a mod-owned entry that every
 * structure must name, and it is the *only* required owner of the link. It then
 * either
 *
 *   - stays mod-owned — "Unlock by default", no research needed, the structure
 *     is force-unlocked at apply; or
 *   - **builds an in-game tech node** — the panel registers a real engine tech
 *     from it, and research is what grants the structure.
 *
 * The second mode is the point. A mod does not need a hand-written tech entry
 * per structure: a node *is* the research step, and editing it edits the real
 * tech. A node may also borrow an existing tech by id instead of defining its
 * own, so several nodes can share one research step.
 *
 * **Failure direction.** A structure with no node, or one naming a node that no
 * longer exists, is treated as *available from the start* — never the reverse.
 * The stricter alternative hides a structure from every fresh game with nothing
 * to say why, and that is the worse bug by a long way.
 */

import { MOD_ID, type ModConfig, type TechConfig, type UnlockNodeConfig } from "../constants.ts";

/** The node every structure gets by default: available with no research. */
export const DEFAULT_UNLOCK_NODE = `${MOD_ID}:unlock.default`;

/**
 * The node a new structure starts on.
 *
 * Virtual rather than stored: it *is* what "available from the start" means, so
 * writing it into every config would be noise, and deleting it from the list
 * would have to fail gracefully anyway.
 */
export function defaultUnlockNode(): UnlockNodeConfig {
    return { id: DEFAULT_UNLOCK_NODE, name: "Unlock by default", kind: "always" };
}

/** Every node a structure can be gated by, default first. */
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

/** The node a structure is gated by, resolving anything missing to the default. */
export function unlockNodeOf(structureId: string, cfg: ModConfig): UnlockNodeConfig {
    const st = (cfg.structures ?? []).find((s) => s?.id === structureId);
    const want = st?.unlockNode?.trim();
    if (!want || want === DEFAULT_UNLOCK_NODE) return defaultUnlockNode();
    return (cfg.unlockNodes ?? []).find((n) => n?.id === want) ?? defaultUnlockNode();
}

/**
 * True when the structure is available from the start — no node, a dangling
 * node, or a node of kind "always".
 */
export function isAlwaysUnlocked(structureId: string, cfg: ModConfig): boolean {
    return unlockNodeOf(structureId, cfg).kind === "always";
}

/** Structures gated by `nodeId`. */
export function structuresForNode(nodeId: string, cfg: ModConfig): string[] {
    return (cfg.structures ?? [])
        .filter((s) => s?.id && unlockNodeOf(s.id, cfg).id === nodeId)
        .map((s) => s.id);
}

/**
 * The engine tech a node builds or borrows, or undefined when it needs none.
 *
 * A node with `techId` borrows that engine tech; otherwise one is built from the
 * node's own fields, so editing the node edits the real tech. Either way this is
 * the only place a mod-owned node becomes something the engine reads, which is
 * what stops the two representations from drifting apart.
 */
export function engineTechOf(node: UnlockNodeConfig, cfg: ModConfig): TechConfig | undefined {
    if (node.kind !== "tech") return undefined;
    if (node.techId) {
        // Borrowed. The engine tech keeps its own definition; this node only says
        // "these structures ride on that one". Returning the stored entry is
        // deliberate — `apply.ts` must not overwrite a hand-written tech with the
        // fields of whichever node happens to point at it.
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

/**
 * Every structure an engine tech grants, once every node is folded in.
 *
 * The engine reads this off the tech alone, so the union is what has to be
 * registered: whatever a hand-written tech already listed, plus every structure
 * whose node builds or borrows it. Deduped, order-stable, and the single place
 * the engine's view is computed — so the registration path and the panel cannot
 * disagree about what a tech grants.
 */
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
        // A node that *builds* this tech and a node that *borrows* it both
        // contribute their structures.
        if (n.id === techId || n.techId === techId) {
            for (const id of structuresForNode(n.id, cfg)) add(id);
        }
    }
    return out;
}

/** The sentence for a node, with no structure in hand. */
export function describeNode(node: UnlockNodeConfig): string {
    const named = node.id === DEFAULT_UNLOCK_NODE ? "Unlock by default" : node.name || node.id;
    if (node.kind === "always") return `Available from the start — ${named}.`;

    const via = node.techId ? `via the engine tech ${node.techId}` : "as its own in-game tech node";
    const cost = node.cost === undefined ? "" : `, costs ${node.cost}`;
    const parent = node.parentId ? `, under ${node.parentId}` : "";
    return `Unlocked by ${named} ${via}${cost}${parent}.`;
}

/**
 * The same sentence, for a structure that is not saved yet.
 *
 * A new or half-edited form has no id to resolve through, so the node the
 * *picker* currently holds is described instead. A structure with no node set is
 * the default, so the answer is the real one rather than a placeholder.
 */
export function unlockLine(
    form: Record<string, string>,
    cfg: ModConfig,
): string {
    const want = (form.unlockNode ?? "").trim();
    if (!want || want === DEFAULT_UNLOCK_NODE) return describeNode(defaultUnlockNode());
    const node = (cfg.unlockNodes ?? []).find((n) => n?.id === want);
    if (node) return describeNode(node);
    // A link to a node that is gone. A dangling node reads as *unlocked* at apply
    // time, so showing only the id would claim a link that does nothing.
    return `⚠ ${want} no longer exists — this structure is available from the start. ` +
        `Pick another node, or the default.`;
}
