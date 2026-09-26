/**
 * verify.ts — Phase 8: check the mod against the audit's own oracle.
 *
 * Phases 0–7 each checked the mod against a *piece* of the api. This is the
 * pass that checks it against the whole thing at once, and it is the reason
 * the artefacts had to be generated rather than written: a check is only worth
 * as much as the index it checks against.
 *
 * Two checks:
 *
 *   1. every api call the mod makes, against the public index — the method
 *      exists, and the call passes at least the required argument count
 *   2. every config key the mod can hand a register call, against what the
 *      engine is known to read or store
 *
 * The second is the one that earns its keep. Every defect the audit found was
 * the same shape — the mod invented or mistranslated a field — so a check that
 * rejects a key the engine has never heard of is the one worth having.
 *
 * Usage: deno test -A tools/verify.test.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const OUT = `${ROOT}doc-bundel/`;

import { METHOD_TO_MOD } from "./extract-definitions.ts";

export interface ApiMember {
    namespace: string;
    name: string;
    params: string;
    argNames: string[];
    required: number;
    total: number;
    deprecated?: boolean;
}

/**
 * Index every member the public api exposes, aliases included.
 *
 * `export import toast = shared.api.ui.toast` lands in a namespace's *aliases*,
 * not its *members*, so indexing members alone makes 36 of the mod's 91 calls
 * look unresolvable. The alias target is looked up in the `shared` index, which
 * carries the real signature.
 */
export function indexPublic(
    pub: { main: any[]; shared: any[] },
): Map<string, ApiMember> {
    const out = new Map<string, ApiMember>();
    // A node either *is* a member (has `params`) or *has* members (a nested
    // namespace), and namespaces nest several deep — `shared.api.elements` is
    // reached only by recursing. A fixed-depth walk misses those, which is why
    // 27 mod calls looked unresolvable before this recursed.
    const walk = (nodes: any[]): void => {
        for (const n of nodes ?? []) {
            if (n.params !== undefined || n.name === undefined) {
                if (n.namespace && n.name) {
                    out.set(`${n.namespace}.${n.name}`, n);
                }
                continue;
            }
            if (Array.isArray(n.members)) walk(n.members);
        }
    };
    walk(pub.shared ?? []);
    walk(pub.main ?? []);

    // resolve aliases onto the namespace they are declared in
    for (const ns of pub.main ?? []) {
        for (const a of ns.aliases ?? []) {
            const target = String(a.target).replace(/;$/, "").trim();
            const found = out.get(target) ?? out.get(
                target.replace(/^shared\.api\./, ""),
            );
            if (!found) continue;
            out.set(`${ns.name}.${a.name}`, {
                ...found,
                namespace: ns.name,
                name: a.name,
                // a deprecated target stays deprecated through its alias
                deprecated: found.deprecated,
            });
        }
    }
    return out;
}

/**
 * A mod call site that must resolve to a real member.
 *
 * `method: null` is not a call at all — it is a reference to the namespace
 * object (`const reg = api.elements`), and `called: false` is a property
 * access. Neither has a signature to check.
 */
export function isRealCall(c: { method: string | null; called: boolean }): boolean {
    return c.called && c.method !== null;
}

/** Split `a, b = 1, { x, y }` into its top-level arguments. */
export function argCount(args: string): number {
    if (!args.trim()) return 0;
    let depth = 0;
    let n = 1;
    let seen = false;
    for (const ch of args) {
        if ("([{<".includes(ch)) depth++;
        else if (")]}>".includes(ch)) depth--;
        else if (ch === "," && depth === 0) n++;
        if (/\S/.test(ch)) seen = true;
    }
    return seen ? n : 0;
}

export function loadArtefacts() {
    return {
        pub: JSON.parse(Deno.readTextFileSync(`${OUT}public-api.json`)),
        calls: JSON.parse(Deno.readTextFileSync(`${OUT}mod-api-calls.json`)),
        defs: JSON.parse(Deno.readTextFileSync(`${OUT}definitions.json`)),
        params: JSON.parse(Deno.readTextFileSync(`${OUT}parameter-map.json`)),
    };
}

/**
 * Mod calls that resolve to nothing in the public api.
 *
 * Every one is a `safe(() => api.x?.y?.(…), fallback)` probe in
 * `src/catalog.ts` — the mod guesses at a discovery api the engine does not
 * offer. They cannot throw and the caller falls back, so the mod works; but
 * the intent they encode is not available.
 *
 * This list is the *finding*, not an exemption to be forgotten. A test asserts
 * the list has not changed, so if a future engine adds one of these the test
 * fails and the comment in `catalog.ts` gets corrected.
 */
export const DEAD_PROBES = new Set([
    "elements.getIdFromType",
    "structures.getRegisteredTypes",
    "structures.getAll",
    "structures.getIdByType",
    "structures.getTypeName",
    "items.getRegistered",
    "items.getAll",
    "items.list",
    "sprites.getLoaded",
    "sprites.getAll",
    "sprites.list",
    "sprites.getRegistered",
]);

/**
 * Config keys the mod owns that the engine's field set does not describe.
 *
 * Either a handler key resolved to a function at apply time, or a form-level
 * alias that `formToEntry` rewrites into a different engine key.
 */
export const MOD_OWN_KEYS = new Set([
    "handlerKey",
    "onDownKey",
    "onUpKey",
    "onUpgradeKey",
    "getOptionsKey",
    "process",
]);

/**
 * Mod config types whose engine payload this audit actually resolved.
 *
 * Derived by intersecting two artefacts rather than one: the config types
 * `METHOD_TO_MOD` feeds into a register call, and the register calls
 * `parameter-map` could resolve to a definition interface. Either set alone is
 * wrong — `METHOD_TO_MOD` includes `RecipeConfig` and friends, which have no
 * `.d.ts` interface at all, so including them flags ~110 false positives. A
 * check that always fails trains people to ignore it.
 */
export function coveredConfigTypes(
    params: { call: string }[],
): Set<string> {
    const out = new Set<string>();
    for (const p of params) {
        const type = METHOD_TO_MOD[p.call];
        if (type) out.add(type);
    }
    return out;
}

/**
 * Config keys the mod declares that the engine does not describe.
 *
 * The *inverse* of the audit's `undeclared` finding. Unlike that list, these
 * are the mod being speculative rather than the typings being incomplete —
 * nothing in the bundle or the `.d.ts` mentions them, and the form does not
 * expose any of them. They survive only because an older config may still
 * carry them, and the store round-trips unknown keys through `advancedJson`.
 *
 * `TerrainConfig.fog` is the clearest case: the bundle's only `.fog` is a
 * property of the *cell-type table*, and `src/ui/schema.ts` already carries a
 * comment saying `fog` is not a documented terrain property — yet the field was
 * still listed as form-owned in `FORM_COVERED`. That entry is removed, so any
 * stored value now round-trips untouched instead of being claimed.
 */
export const TYPINGS_OMIT = new Set([
    // the mod reaches further than the engine documents
    "TerrainConfig.displayNameOverrideKey",
    "TerrainConfig.colorPattern",
    "TerrainConfig.colorGradient",
    "TerrainConfig.background",
    "TerrainConfig.backgroundElementType",
    "TerrainConfig.fog",
    "TerrainConfig.flammable",
    "TerrainConfig.noShadow",
    "TerrainConfig.isBuilding",
    "ProjectileConfig.options",
    "TriggerConfig.triggerId",
    // the engine uses these but the shipped `.d.ts` omits them
    "ElementConfig.duration",
    "ElementConfig.durationRandom",
    "ElementConfig.flammable",
    "ElementConfig.hidden",
    "StructureConfig.hideFromBuildMenu",
    "StructureConfig.disallowPick",
    "StructureConfig.altOriginOffsetY",
    "StructureConfig.registerOptions",
    // Not an engine field: this is *our* key. The engine field is `draw`, a
    // function, which JSON cannot hold, so the config stores a key and
    // `apply.ts`'s resolveDraw swaps it for the real function at register time.
    "StructureConfig.drawKey",
]);
