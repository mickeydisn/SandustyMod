import { actionFacts } from "./action-facts.ts";
import { BLOCK_KEY, type ActionDef } from "./types.ts";
import { ALL_ACTIONS } from "../actions/index.ts";
import type { ActionKey } from "../actions/index.ts";
import { actionRefsOf, flattenRefs, isBlock } from "../processing/process.ts";
import type { OptionKeysLookup } from "../processing/process.ts";
import { slotsFor } from "../processing/scope.ts";
import { projectileOptionOf } from "../processing/projectile-option/index.ts";
import { excavationOptionOf } from "../processing/excavation-option/index.ts";
import { SLOT_LOCATION, SLOTS_BY_CATEGORY } from "./registry/categories.ts";

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

export function slotsForEntry(
    m: { key: ActionKey; type: HandlerType },
): HandlerSlot[] {
    const needed = slotsFor(m.key);
    const narrowed = TYPE_SLOTS[m.type];
    if (!narrowed) return needed;
    return needed.filter((s) => narrowed.includes(s));
}

/**
 * One row per action, for the panel and the compile-time option check.
 *
 * The metadata is read off the action definition and the slot list is derived
 * from what the action needs, so there is no second table to keep in step.
 * `slots` is the derived list; `declaredSlots` keeps whatever the action
 * pinned by hand, which is empty for actions that declare nothing.
 */
export const HANDLER_META: HandlerMeta[] = (Object.entries(ALL_ACTIONS) as
    [ActionKey, ActionDef][]).map(([key, m]) => {
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
        api: facts?.api || undefined,
        cls: facts?.cls ?? "pure",
        itemTypes: m.itemTypes as string[] | undefined,
        slots: derived.length ? derived : entry.slots,
        declaredSlots: entry.slots,
    };
});
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

/** The config-key → call-site map, re-exported for the panel's tab lookup. */
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
