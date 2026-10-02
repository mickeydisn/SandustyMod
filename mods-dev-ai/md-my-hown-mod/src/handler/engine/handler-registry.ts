import { actionFacts } from "./action-facts.ts";
import { BLOCK_KEY, type ActionDef } from "./types.ts";
import { ALL_ACTIONS } from "../actions/index.ts";
import type { ActionKey } from "../actions/index.ts";
import { actionRefsOf, flattenRefs, isBlock } from "../processing/process.ts";
import type { OptionKeysLookup } from "../processing/process.ts";
import { slotsFor } from "../processing/scope.ts";
import { projectileOptionOf } from "../processing/projectile-option/index.ts";
import { excavationOptionOf } from "../processing/excavation-option/index.ts";

// Types, labels and the shared option-parameter builders live next door.
export * from "./registry/types.ts";
export {
    DATA_PARAMS,
    CREATE_PARAMS,
    MATRIX_PARAMS,
    MOTION_REGION_PARAMS,
    RANGE_PARAMS,
    REGION_PARAMS,
    REMOVAL_PARAMS,
    STRUCTURE_REF_PARAMS,
    TERRAIN_REF_PARAMS,
    TERRAIN_SHAPE_PARAMS,
    VELOCITY_PARAMS,
    elementRef,
    p,
    structureRef,
    terrainRef,
} from "./registry/params.ts";
import {
    HANDLER_SCOPE_LABELS,
    type HandlerMeta,
    type HandlerScope,
    type HandlerSlot,
    type HandlerType,
} from "./registry/types.ts";
import type { HandlerParam } from "./types.ts";

const TYPE_SLOTS: Partial<Record<HandlerType, HandlerSlot[]>> = {
    tech: ["upgrade"],
};

/**
 * The slots one action may appear in, narrowed by its handler type.
 *
 * Takes a real `ActionKey`: every caller derives it from `ALL_ACTIONS`, so
 * there is no unknown key to accommodate here. The `as HandlerSlot[]` that
 * used to sit on `slotsFor`'s result is gone — `slotsFor` returns slots.
 */
export function slotsForEntry(
    m: { key: ActionKey; type: HandlerType },
): HandlerSlot[] {
    const needed = slotsFor(m.key);
    const narrowed = TYPE_SLOTS[m.type];
    if (!narrowed) return needed;
    return needed.filter((s) => narrowed.includes(s));
}

/**
 * The panel's view of every action.
 *
 * Built from the action definitions themselves: each one now declares its own
 * `type`, `scope`, `slots` and `params`, so there is no second table to keep in
 * step with the first. The engine's own scope check (`slotsFor`) still wins,
 * and the declaration is kept alongside it as `declaredSlots` for diagnostics.
 */
export const HANDLER_META: HandlerMeta[] = (Object.entries(ALL_ACTIONS) as
    [ActionKey, ActionDef][]).map(
        ([key, def]) => {
            const m = def as ActionDef;
            const entry = {
                key,
                type: (m.type ?? "cell") as HandlerType,
                scope: (m.scope ?? "cell") as HandlerScope,
                slots: (m.slots ?? []) as HandlerSlot[],
                params: (m.params ?? []) as HandlerParam[],
            };
        const derived = slotsForEntry(entry);
        const facts = actionFacts(key);
        return {
            ...entry,
            // `api` is absent for engine-free actions; the record states that as "",
            // so translate rather than leaking an empty string into the panel.
            api: facts?.api || undefined,
            cls: facts?.cls ?? "pure",
            itemTypes: m.itemTypes as string[] | undefined,
            slots: derived.length ? derived : entry.slots,
            declaredSlots: entry.slots,
        } as HandlerMeta;
    },
);
export const BLOCK_META: HandlerMeta = {
    key: BLOCK_KEY,
    type: "block",
    cls: "pure",

    slots: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
    scope: "cell",
    params: [
        {
            key: "var",
            label: "When variable is true",
            kind: "text",
            required: true,
            hint:
                "The name a step bound with As. Both branches are compiled; the one that runs is chosen at run time.",
        },
    ],
};

const META_BY_KEY: Record<string, HandlerMeta> = Object.fromEntries(
    HANDLER_META.map((m) => [m.key, m]),
);

export function handlerMeta(key: string | undefined): HandlerMeta | undefined {
    return key ? META_BY_KEY[key] : undefined;
}

/**
 * The option names an action accepts, from its own declaration.
 *
 * Handed to `compileProcess` by the caller rather than pushed into it at import
 * time, so the compiler does not have to reach back up into the registry.
 */
export const optionKeysFor: OptionKeysLookup = (key) => {
    const meta = handlerMeta(key);
    if (!meta) return undefined;
    const names = new Set<string>();
    for (const p of meta.params ?? []) names.add(p.key);

    names.add("key");
    names.add("as");
    return names;
};

export function handlersForSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.slots.includes(slot));
}

export function isOnlyAtSlot(meta: HandlerMeta, slot: HandlerSlot): boolean {
    return meta.slots.length === 1 && meta.slots[0] === slot;
}

export function handlersOnlyAtSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => isOnlyAtSlot(m, slot));
}

export function handlersOfType(type: HandlerType): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.type === type);
}

export function allHandlerTypes(): HandlerType[] {
    const seen: HandlerType[] = [];
    for (const m of HANDLER_META) if (!seen.includes(m.type)) seen.push(m.type);
    return seen;
}

export function isHandlerKey(key: string | undefined): boolean {
    return !!key && key in META_BY_KEY;
}

export const HANDLER_SLOT_LABELS: Record<HandlerSlot, string> = {
    signal: "Signals (structure click)",
    trigger: "Triggers (timed)",
    processing: "Processing (process step)",
    upgrade: "Upgrades / research",
    modifier: "Hook modifiers",
    itemAction: "Items (handleAction)",
};

export const HANDLER_SCOPES = Object.keys(HANDLER_SCOPE_LABELS) as HandlerScope[];

export function validateHandlerParams(
    meta: HandlerMeta,
    values: Record<string, string>,
): string[] {
    const errs: string[] = [];
    for (const spec of meta.params) {
        const raw = (values[spec.key] ?? "").trim();
        if (spec.required && raw === "") {
            errs.push(`${spec.label} is required`);
            continue;
        }
        if (raw === "") continue;
        if (spec.kind === "number") {
            const n = Number(raw);
            if (!Number.isFinite(n)) {
                errs.push(`${spec.label} must be a number`);
                continue;
            }
            if (spec.int && !Number.isInteger(n)) errs.push(`${spec.label} must be a whole number`);
            if (spec.min !== undefined && n < spec.min) {
                errs.push(`${spec.label} must be ≥ ${spec.min}`);
            }
            if (spec.max !== undefined && n > spec.max) {
                errs.push(`${spec.label} must be ≤ ${spec.max}`);
            }
        }
        if (spec.kind === "select") {
            if (spec.content) {
            } else if (spec.options) {
                if (!spec.options.some((o) => o.value === raw)) {
                    errs.push(
                        `${spec.label} must be one of: ${
                            spec.options.map((o) => o.value).join(", ")
                        }`,
                    );
                }
            }
        }
    }
    return errs;
}

export function handlerTypesForKeys(keys: string[]): HandlerType[] {
    const byKey = new Map(HANDLER_META.map((m) => [m.key, m.type]));
    const seen = new Set<HandlerType>();
    for (const k of keys) {
        const t = byKey.get(k);
        if (t) seen.add(t);
    }
    return [...seen];
}

export function buildHandlerOptions(
    meta: HandlerMeta,
    values: Record<string, string>,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const spec of meta.params) {
        const raw = (values[spec.key] ?? "").trim();
        if (raw === "") continue;
        if (spec.kind === "number") {
            const n = Number(raw);
            if (Number.isFinite(n)) out[spec.key] = spec.int ? Math.trunc(n) : n;
        } else if (spec.kind === "bool") {
            out[spec.key] = raw === "true";
        } else {
            out[spec.key] = raw;
        }
    }
    return out;
}

/** The one place a slot and its config key are written down. */
const SLOT_LOCATION: Record<HandlerSlot, string> = {
    signal: "signals",
    trigger: "triggers",
    processing: "processing",
    upgrade: "upgrades",
    modifier: "modifiers",
    itemAction: "items",
};

/**
 * Config key -> slot. Derived from SLOT_LOCATION so the two can never drift.
 *
 * This used to be a second hand-written table named TAB_TO_CALL_SITE, holding the
 * same six pairs. Same failure mode as the four per-action tables: two lists of the
 * same facts, kept in sync by hand.
 */
const SLOTS_BY_CATEGORY: Record<string, HandlerSlot> = Object.fromEntries(
    Object.entries(SLOT_LOCATION).map(([slot, cfgKey]) => [cfgKey, slot as HandlerSlot]),
);

export { SLOTS_BY_CATEGORY };
export const TAB_TO_CALL_SITE = SLOTS_BY_CATEGORY;

export interface HandlerUsage {
    category: string;
    id: string;
    slot: HandlerSlot;

    key?: string;
}

export function scanHandlerUsage(cfg: Record<string, unknown>): HandlerUsage[] {
    const out: HandlerUsage[] = [];
    for (const [slot, cfgKey] of Object.entries(SLOT_LOCATION) as [HandlerSlot, string][]) {
        const list = cfg[cfgKey];
        if (!Array.isArray(list)) continue;
        for (const e of list as Record<string, unknown>[]) {
            const refs = flattenRefs(actionRefsOf(e as Record<string, unknown>));
            for (const key of refs.map((r) => r.key)) {
                if (isBlock({ key })) continue;
                out.push({ category: cfgKey, id: String(e.id ?? "?"), slot, key });
            }
        }
    }
    return out;
}

export function scanProjectileOptionUsage(
    cfg: Record<string, unknown>,
): { category: string; id: string; key?: string; problem?: string }[] {
    const list = cfg.projectiles;
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).map((e) => {
        const { ref, problem } = projectileOptionOf(e);
        return {
            category: "projectiles",
            id: String(e?.id ?? "?"),
            key: ref?.key,
            problem,
        };
    });
}

export function scanExcavationOptionUsage(
    cfg: Record<string, unknown>,
): { category: string; id: string; key?: string; problem?: string }[] {
    const list = cfg.excavationProfiles;
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).map((e) => {
        const { ref, problem } = excavationOptionOf(e);
        return {
            category: "excavationProfiles",
            id: String(e?.id ?? "?"),
            key: ref?.key,
            problem,
        };
    });
}

function findKeyForUsage(cfg: Record<string, unknown>, u: HandlerUsage): string {
    const cfgKey = SLOT_LOCATION[u.slot];
    const list = (cfg[cfgKey] ?? []) as Record<string, unknown>[];
    const e = list.find((x) => String(x?.id) === u.id);
    if (!e) return "";

    return u.key ?? actionRefsOf(e)[0]?.key ?? "";
}

export function unreachableHandlers(
    cfg: Record<string, unknown>,
): { key: string; usage: HandlerUsage; reason: string }[] {
    const bad: { key: string; usage: HandlerUsage; reason: string }[] = [];
    for (const u of scanHandlerUsage(cfg)) {
        const meta = handlerMeta(findKeyForUsage(cfg, u));
        if (!meta) continue;
        if (!meta.slots.includes(u.slot)) {
            bad.push({
                key: meta.key,
                usage: u,
                reason: `a ${meta.type} handler cannot serve the ${u.slot} slot`,
            });
        }
    }
    return bad;
}

export function usageIndex(cfg: Record<string, unknown>): Record<string, HandlerUsage[]> {
    const idx: Record<string, HandlerUsage[]> = {};
    for (const u of scanHandlerUsage(cfg)) {
        const key = findKeyForUsage(cfg, u);
        if (!key) continue;
        (idx[key] ??= []).push(u);
    }
    return idx;
}
