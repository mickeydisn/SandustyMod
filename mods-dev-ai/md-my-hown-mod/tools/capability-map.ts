/**
 * capability-map.ts — Phase 4: what the mod can reach, and what it cannot.
 *
 * The api is much larger than the interface. The useful question is not "how
 * many members exist" but "which of them could a mod author actually drive from
 * a saved config", and that turns on whether the engine stores the result.
 *
 * The rule this uses: a call is **exposable** when it is a registration or a
 * query over stored state. A call that only mutates live state — moving a
 * structure, firing an effect, playing a sound — is a *capability for game
 * code*, not something a config file can express. Both are supported by the
 * api; only the first is reachable from the mod's declarative layer.
 *
 * Usage: deno run -A tools/capability-map.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = HERE.replace(/\/tools\/$/, "");
const OUT = `${ROOT}/doc-bundel/`;

export type Role =
    /** the engine stores the result, so a config can create it */
    | "registerable"
    /** reads stored state; a config can consume it to pick a valid reference */
    | "queryable"
    /** mutates live runtime state; only game code can drive this */
    | "runtime"
    /** bookkeeping, ids, reflection, or plain host plumbing */
    | "internal";

export interface Classification {
    role: Role;
    /** why this member got this role */
    why: string;
}

const REGISTER = /^register|^addProcessor$|^addStorageType$|^addStructureType$/;
/**
 * Only `updateDefinition` rewrites a stored definition. `updateEnergy` and
 * `ui.update` merely change live state, so a prefix match on `update` would
 * wrongly count them as config-reachable.
 */
const UPDATE = /^updateDefinition$/;
const QUERY = /^(get|is|has|can|find|select|resolve|forEach|map|query|list|count|exists|describe)/;
/**
 * Any other `update*` changes something live — a resource total, a component's
 * state — so it is runtime. `updateDefinition` is matched first and stays
 * registerable.
 */
const RUNTIME =
    /^(set|add|remove|clear|delete|move|play|stop|start|emit|spawn|drop|pick|apply|begin|end|build|destroy|damage|heal|toggle|reset|trigger|invoke|use|consume|give|take|insert|push|unregister|press|release|collect|upgrade|update)/;

export function classify(name: string, kind: string): Classification {
    if (kind === "value") {
        return { role: "internal", why: "a constant or enum member, not a call" };
    }
    if (UPDATE.test(name)) {
        return {
            role: "registerable",
            why: "rewrites a stored definition, so it stays config-driven",
        };
    }
    if (REGISTER.test(name)) {
        return {
            role: "registerable",
            why: "the engine stores the result, so a saved config can create it",
        };
    }
    if (RUNTIME.test(name)) {
        return {
            role: "runtime",
            why: "mutates live state; only game code can drive it, not a config",
        };
    }
    if (QUERY.test(name)) {
        return {
            role: "queryable",
            why: "reads stored state, so a config can reference what it returns",
        };
    }
    return {
        role: "internal",
        why: "bookkeeping or host plumbing with no config-visible effect",
    };
}

// ------------------------------------------------------------ mod coverage

/** The mod's own `register*` exports, read from the wrapper source. */
export function modRegisters(src: string): Set<string> {
    const out = new Set<string>();
    for (
        const m of src.matchAll(/export function (register[A-Za-z]*)\s*\(/g)
    ) {
        out.add(m[1]);
    }
    return out;
}

/**
 * Aliases bound straight off the api, so a wrapped call still counts as coverage.
 *
 * `const sig = g()?.api?.signals;` followed by `sig.targets?.register(…)` reaches
 * `signals.targets.register`. Without resolving the alias, that reads as an
 * uncovered capability when the mod is in fact fully wired.
 */
export function apiAliases(src: string): Map<string, string> {
    const out = new Map<string, string>();
    for (
        const m of src.matchAll(
            /(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*?\bapi\??\.(\w+)/g,
        )
    ) {
        out.set(m[1], m[2]);
    }
    return out;
}

/**
 * The api paths the mod's wrappers actually drive, read from the wrapper source
 * so this map cannot drift from the code that ships.
 *
 * Chains are followed, because nested namespaces are reached by chained access
 * — `api?.structures?.processing?.register` touches `structures.processing`, and
 * a single-segment match would miss it and report the namespace as uncovered.
 */
export function modNamespaces(src: string): Set<string> {
    const aliases = apiAliases(src);
    const out = new Set<string>();
    /**
     * Record `root` plus every extension of it, starting at `head` (the segment
     * the caller already consumed) and walking on from `from`.
     */
    const walk = (root: string, head: string | null, from: number) => {
        out.add(root);
        let tail = from;
        let path = root;
        if (head) {
            path = `${root}.${head}`;
            out.add(path);
        }
        for (;;) {
            const next = src.slice(tail).match(/^\??\.(\w+)/);
            if (!next) break;
            path = `${path}.${next[1]}`;
            out.add(path);
            tail += next[0].length;
        }
    };
    for (const m of src.matchAll(/\bapi\??\.(\w+)/g)) {
        const first = m[1];
        if (["api", "raw", "enums", "react"].includes(first)) continue;
        // `first` is the namespace itself, and it sits inside the match
        walk(first, null, m.index! + m[0].length);
    }
    for (const m of src.matchAll(/\b(\w+)\??\.(\w+)/g)) {
        const base = aliases.get(m[1]);
        if (!base) continue;
        // the alias names the root, so `m[2]` is its first segment
        walk(base, m[2], m.index! + m[0].length);
    }
    return out;
}

export interface CapabilityRow {
    namespace: string;
    members: number;
    registerable: number;
    queryable: number;
    runtime: number;
    internal: number;
    /** the mod's wrappers drive this namespace */
    modUses: boolean;
    /** registerable members here that the mod has no wrapper for */
    unwrapped: string[];
}

export interface CapabilityMap {
    totals: {
        namespaces: number;
        members: number;
        registerable: number;
        queryable: number;
        runtime: number;
        internal: number;
    };
    rows: CapabilityRow[];
    /** namespaces with registerable members and no mod coverage at all */
    uncovered: string[];
    /** registerable public members with no mod wrapper */
    unwrapped: string[];
    /** the mod's own register wrappers */
    modWrappers: string[];
}

// -------------------------------------------------------------------- main

export function build(pub: any, wrapperSrc: string): CapabilityMap {
    const used = modNamespaces(wrapperSrc);
    const wrappers = [...modRegisters(wrapperSrc)].sort();

    const rows: CapabilityRow[] = pub.main.map((n: any) => {
        const counts = { registerable: 0, queryable: 0, runtime: 0, internal: 0 };
        const unwrapped: string[] = [];
        // the typings declare overloads, so one method name appears several
        // times; a capability exists once, however many signatures it has
        const seen = new Set<string>();
        for (const m of n.members) {
            const { role } = classify(m.name, m.kind);
            counts[role]++;
            // members carry no `path` field, so the full api path is built here
            if (role === "registerable" && !used.has(n.name)) {
                const path = `${n.name}.${m.name}`;
                if (!seen.has(path)) {
                    seen.add(path);
                    unwrapped.push(path);
                }
            }
        }
        return {
            namespace: n.name,
            members: n.members.length,
            ...counts,
            modUses: used.has(n.name),
            unwrapped: unwrapped.sort(),
        };
    });

    const totals = { registerable: 0, queryable: 0, runtime: 0, internal: 0 };
    for (const r of rows) {
        totals.registerable += r.registerable;
        totals.queryable += r.queryable;
        totals.runtime += r.runtime;
        totals.internal += r.internal;
    }

    return {
        totals: {
            namespaces: rows.length,
            members: rows.reduce((a, b) => a + b.members, 0),
            ...totals,
        },
        rows: rows.sort((a, b) =>
            (b.registerable - a.registerable) ||
            (b.members - a.members) ||
            a.namespace.localeCompare(b.namespace)
        ),
        uncovered: rows
            .filter((r) => !r.modUses && r.registerable > 0)
            .map((r) => r.namespace)
            .sort(),
        unwrapped: rows.flatMap((r) => r.unwrapped).sort(),
        modWrappers: wrappers,
    };
}

function render(map: CapabilityMap): string {
    const t = map.totals;
    const pct = (n: number) => `${Math.round((n / t.members) * 100)}%`;
    return `# Capability map

Generated by \`tools/capability-map.ts\`. Do not edit by hand.

A member is **registerable** when the engine stores what it is given, so a saved
config can create it. A member is **runtime** when it only mutates live state —
a config cannot express "play this sound" any more than it can express "walk
there". Both are supported by the api; only the registerable half is reachable
from the mod's declarative layer.

| role | count | share | reachable from a config |
|---|---|---|---|
| registerable | ${t.registerable} | ${pct(t.registerable)} | **yes** |
| queryable | ${t.queryable} | ${pct(t.queryable)} | indirectly, as a picker source |
| runtime | ${t.runtime} | ${pct(t.runtime)} | no — game code only |
| internal | ${t.internal} | ${pct(t.internal)} | no |

${t.namespaces} namespaces, ${t.members} members. The mod has **${map.modWrappers.length}** register wrappers.

## Namespaces by what they contribute

| namespace | reg | query | runtime | internal | total | mod |
|---|---|---|---|---|---|---|
${
        map.rows.map((r) =>
            `| \`${r.namespace}\` | ${r.registerable} | ${r.queryable} | ${r.runtime} | ${r.internal} | ${r.members} | ${
                r.modUses ? "yes" : "—"
            } |`
        ).join("\n")
    }

## Registerable members with no mod wrapper

${
        map.unwrapped.length === 0
            ? "None — the mod wraps every registerable member."
            : map.unwrapped.map((p) => `- \`${p}\``).join("\n")
    }

## Namespaces with registerable members and no coverage

${map.uncovered.length === 0 ? "None." : map.uncovered.map((n) => `- \`${n}\``).join("\n")}

## The mod's wrappers

${map.modWrappers.map((w) => `- \`${w}\``).join("\n")}
`;
}

if (import.meta.main) {
    const pub = JSON.parse(Deno.readTextFileSync(`${OUT}/public-api.json`));
    const wrapperSrc = Deno.readTextFileSync(`${ROOT}/src/packages/mysandkit.ts`);
    const map = build(pub, wrapperSrc);
    await Deno.writeTextFile(
        `${OUT}capability-map.json`,
        JSON.stringify(map, null, 2) + "\n",
    );
    await Deno.writeTextFile(`${OUT}CAPABILITY-MAP.md`, render(map));
    const t = map.totals;
    console.log(`namespaces     : ${t.namespaces}`);
    console.log(`members        : ${t.members}`);
    console.log(`registerable   : ${t.registerable}  (config-reachable)`);
    console.log(`queryable      : ${t.queryable}`);
    console.log(`runtime        : ${t.runtime}  (game code only)`);
    console.log(`internal       : ${t.internal}`);
    console.log(`\nmod wrappers   : ${map.modWrappers.length}`);
    console.log(`uncovered      : ${map.uncovered.length} namespaces`);
    console.log(`unwrapped      : ${map.unwrapped.length} members`);
    console.log(`-> ${OUT}CAPABILITY-MAP.md`);
}
