/**
 * Typed handler registry.
 *
 * Every callable this mod exposes to JSON config gets ONE entry here saying
 * what kind of thing it is, which config slots may select it, how it is scoped
 * and which parameters it reads. The UI's handler tab, the per-slot pickers and
 * the validator all read this file, so a handler can never be offered in a slot
 * it cannot actually serve.
 *
 * This replaces the old hand-maintained key arrays (SIGNAL_HANDLERS,
 * TRIGGER_HANDLERS, PROJECTILE_HANDLERS, UPGRADE_HANDLERS) which silently
 * drifted out of sync with the real registries.
 */

import { ACTION_APIS, ACTION_CLASSES, type HandlerActionClass } from "./action-class.ts";
// `process.ts` imports only `handlers.ts`, so this is not a cycle.
import { actionRefsOf } from "./process.ts";

/** What a handler fundamentally does. Drives grouping in the handler tab. */
export type HandlerType =
    | "global"
    | "cell"
    | "message"
    | "tech"
    | "processor"
    | "projectile"
    | "modifier";

/** A config slot that can select a handler. */
export type HandlerSlot =
    | "signal"
    | "trigger"
    | "processing"
    | "projectile"
    | "upgrade"
    | "modifier"
    | "itemAction";

/** How widely a handler applies. */
export type HandlerScope = "global" | "structure" | "cell" | "tech" | "item";

export interface HandlerParam {
    key: string;
    label: string;
    kind: "text" | "number" | "bool" | "select";
    required?: boolean;
    def?: string;
    hint?: string;
    min?: number;
    max?: number;
    int?: boolean;
    /** `select` only. */
    options?: { value: string; label: string }[];
}

export interface HandlerMeta {
    key: string;
    /**
     * @deprecated Blends both axes and matches neither — `cell` spans three call
     * sites, `tech` is an API name on a call site. Kept only so the Handlers tab
     * keeps working until Phase 6 regroups on `api` and `cls`. See PLAN.md.
     */
    type: HandlerType;
    /**
     * The `api.*` namespace this action calls — **derived**, so it cannot drift
     * from what the code does. Undefined for the 38 actions that call no API.
     */
    api?: string;
    /**
     * What the action depends on — **derived** from the same probe. `api` is the
     * rule; the other three record how far short of it the action falls.
     */
    cls: HandlerActionClass;
    /** Slots allowed to select this handler. */
    slots: HandlerSlot[];
    /** Default scope; a handler may be rebound per use. */
    scope: HandlerScope;
    /**
     * `itemAction` slot only: which `ItemType`s may use this handler.
     *
     * `ItemType` is Weapon|Tool|Consumable|Mod, but the `ActionType` that
     * `handleAction` receives is Weapon|Building|Tool|Mod — there is no
     * Consumable, so no handler can ever serve one. Anything left undefined here
     * is offered for every type.
     */
    itemTypes?: string[];
    /** Parameters read from the entry's `options` bag. */
    params: HandlerParam[];
}

export const HANDLER_TYPE_LABELS: Record<HandlerType, string> = {
    global: "Global",
    cell: "Cell",
    message: "Message",
    tech: "Tech",
    processor: "Processor",
    projectile: "Projectile",
    modifier: "Modifier",
};

export const HANDLER_TYPE_BLURBS: Record<HandlerType, string> = {
    global: "Engine-agnostic utilities — safe anywhere.",
    cell: "Read or write the cell grid (digging, energy, scanning).",
    message: "React to an engine event: a click, a tick, an item use.",
    tech: "Run when research completes or an item is upgraded.",
    processor: "One step of a structure's process() run.",
    projectile: "Builds a projectile's spawn-time options.",
    modifier: "Intercept or rewrite an engine hook.",
};

export const HANDLER_SCOPE_LABELS: Record<HandlerScope, string> = {
    global: "Global",
    structure: "Structure",
    cell: "Cell",
    tech: "Tech node",
    item: "Item",
};

// ── Convenience builders ─────────────────────────────────────────────────────

const p = (
    key: string,
    label: string,
    kind: HandlerParam["kind"] = "text",
    extra: Partial<HandlerParam> = {},
): HandlerParam => ({ key, label, kind, ...extra });

const MSG_SLOTS = ["signal", "trigger", "itemAction"] as const satisfies readonly HandlerSlot[];
const ALL_SLOTS = [
    "signal",
    "trigger",
    "processing",
    "projectile",
    "upgrade",
    "modifier",
    "itemAction",
] as const satisfies readonly HandlerSlot[];

/** The registry. One row per callable reachable from JSON config. */
/**
 * The declared catalogue, with the two derived axes filled in.
 *
 * `api` and `cls` are computed from `ACTION_CLASSES` / `ACTION_APIS` rather than
 * written out per entry, because 46 hand-maintained copies of a measured fact is
 * 46 chances to be wrong — and the measurement already has a test that checks it
 * against behaviour.
 *
 * The raw list stays separate so the entries above read as a plain table; only
 * this export carries the derived fields, and it is the one everything imports.
 */
const DECLARED_META: Omit<HandlerMeta, "cls">[] = [
    // ── global ───────────────────────────────────────────────────────────────
    { key: "noop", type: "global", slots: [...ALL_SLOTS], scope: "global", params: [] },
    {
        key: "itemDefault",
        type: "global",
        slots: ["itemAction"],
        scope: "item",
        itemTypes: ["Mod"],
        params: [p("power", "Power", "number", { def: "5", min: 0 })],
    },
    { key: "processorNoop", type: "global", slots: ["processing"], scope: "structure", params: [] },

    // ── cell ─────────────────────────────────────────────────────────────────
    // The excavation* presets are the cell-digging behaviour a Tool uses.
    {
        key: "excavationDefault",
        type: "cell",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [p("power", "Power", "number", { def: "10", min: 0 })],
    },
    {
        key: "excavationCrusher",
        type: "cell",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [p("power", "Power", "number", { def: "24", min: 0 })],
    },
    {
        key: "excavationDrill",
        type: "cell",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [
            p("power", "Power", "number", { def: "8", min: 0 }),
            p("drillTierDamage", "Drill tier damage", "number", { def: "25", min: 0, int: true }),
        ],
    },
    {
        key: "excavationGun",
        type: "cell",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [p("power", "Power", "number", { def: "4", min: 0 })],
    },
    {
        key: "excavationShatter",
        type: "cell",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [p("power", "Power", "number", { def: "16", min: 0 })],
    },
    {
        key: "energyDefault",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "1000", min: 0, int: true })],
    },
    {
        key: "energyBank",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "100000", min: 0, int: true })],
    },
    {
        key: "energyWire",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "200", min: 0, int: true })],
    },
    {
        key: "energyConductor",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [p("capacity", "Capacity", "number", { def: "0", min: 0, int: true })],
    },
    {
        key: "energyNetwork",
        type: "cell",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", {
                required: true,
                hint: "network name to join",
            }),
        ],
    },
    {
        key: "triggerScan",
        type: "cell",
        slots: ["trigger"],
        scope: "cell",
        params: [p("radius", "Radius", "number", { def: "3", min: 0, int: true })],
    },
    // ── message ──────────────────────────────────────────────────────────────
    { key: "signalLog", type: "message", slots: ["signal"], scope: "structure", params: [] },
    { key: "structureInspect", type: "message", slots: ["signal"], scope: "structure", params: [] },
    {
        key: "structureReadData",
        type: "message",
        slots: ["signal"],
        scope: "structure",
        params: [
            p("field", "Data field", "text", {
                required: true,
                hint: "key on the structure's data object",
            }),
        ],
    },
    {
        key: "structureWriteData",
        type: "message",
        slots: ["signal"],
        scope: "structure",
        params: [
            p("field", "Data field", "text", { required: true }),
            p("value", "Value", "text", { required: true }),
        ],
    },
    { key: "triggerLog", type: "message", slots: ["trigger"], scope: "global", params: [] },
    { key: "triggerTick", type: "message", slots: ["trigger"], scope: "global", params: [] },
    {
        key: "itemExcavate",
        type: "message",
        slots: ["itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [
            p("profileId", "Excavation profile", "text", {
                hint: "falls back to the item's excavationProfileId",
            }),
            p("power", "Power", "number", { def: "10", min: 0 }),
        ],
    },
    {
        key: "itemShoot",
        type: "message",
        slots: ["itemAction"],
        scope: "global",
        itemTypes: ["Weapon"],
        params: [
            p("projectileId", "Projectile", "text", {
                hint: "falls back to the item's projectileId",
            }),
            p("power", "Power", "number", { def: "5", min: 0 }),
            p("speed", "Speed", "number", { def: "20", min: 0 }),
        ],
    },

    // ── processor ────────────────────────────────────────────────────────────
    {
        key: "processorLog",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
    },
    {
        key: "processorScan",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [p("radius", "Radius", "number", { def: "1", min: 0, int: true })],
    },
    {
        key: "processorLift",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("x", "Cell x", "number", { min: 0, int: true }),
            p("y", "Cell y", "number", { min: 0, int: true }),
        ],
    },
    {
        key: "processorConvert",
        type: "processor",
        slots: ["processing"],
        scope: "cell",
        params: [
            p("to", "Output element", "text", {
                required: true,
                hint: "element id committed into the cell",
            }),
            p("chance", "Chance", "number", { def: "1", min: 0, max: 1 }),
        ],
    },
    {
        key: "processorCount",
        type: "processor",
        slots: ["processing"],
        scope: "structure",
        params: [],
    },
    {
        key: "energyGenerateWhileHeld",
        type: "processor",
        slots: ["processing", "trigger"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
    },
    {
        key: "energyConsumePerRun",
        type: "processor",
        slots: ["processing", "trigger"],
        scope: "cell",
        params: [
            p("energyType", "Energy type", "text", { required: true }),
            p("amountPerRun", "Amount per run", "number", { def: "1", min: 0 }),
        ],
    },
    // ── projectile ───────────────────────────────────────────────────────────
    {
        key: "defaultProjectileOptions",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileHeavy",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileFast",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileHoming",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileShotgun",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileExcavate",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },
    {
        key: "projectileTerrain",
        type: "projectile",
        slots: ["projectile"],
        scope: "global",
        params: [],
    },

    // ── tech ─────────────────────────────────────────────────────────────────
    {
        key: "techAppendUnlock",
        type: "tech",
        slots: ["upgrade"],
        scope: "tech",
        params: [p("techId", "Tech node", "text", { required: true })],
    },
    {
        key: "techSetUpgradeLevel",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("itemId", "Item", "text", { required: true }),
            p("level", "Level", "number", { def: "1", min: 0, int: true }),
        ],
    },
    {
        key: "techGrantItem",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("itemId", "Item", "text", { required: true }),
            p("count", "Count", "number", { def: "1", min: 0, int: true }),
        ],
    },
    {
        key: "upgradeCountLevel",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [p("field", "Data field", "text", { def: "mdLevel" })],
    },
    { key: "upgradeLog", type: "tech", slots: ["upgrade"], scope: "item", params: [] },
    {
        key: "upgradeScale",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("field", "Numeric field", "text", { required: true }),
            p("factor", "Factor", "number", { def: "1.1", min: 0 }),
        ],
    },
    {
        key: "upgradeAdd",
        type: "tech",
        slots: ["upgrade"],
        scope: "item",
        params: [
            p("field", "Numeric field", "text", { required: true }),
            p("amount", "Amount", "number", { def: "1" }),
        ],
    },

    // ── modifier ────────────────────────────────────────────────────────────
    { key: "logArgs", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    { key: "identity", type: "modifier", slots: ["modifier"], scope: "global", params: [] },
    {
        key: "logBuildingPayload",
        type: "modifier",
        slots: ["modifier"],
        scope: "global",
        params: [],
    },
];

export const HANDLER_META: HandlerMeta[] = DECLARED_META.map((m) => ({
    ...m,
    api: ACTION_APIS[m.key],
    // An action with no measurement is `pure` by default rather than a hole: it
    // reaches for nothing, which is the weakest claim and the safe default. The
    // inventory test in action-class.test.ts is what catches a real omission.
    cls: ACTION_CLASSES[m.key] ?? "pure",
}));

const META_BY_KEY: Record<string, HandlerMeta> = Object.fromEntries(
    HANDLER_META.map((m) => [m.key, m]),
);

export function handlerMeta(key: string | undefined): HandlerMeta | undefined {
    return key ? META_BY_KEY[key] : undefined;
}

export function handlersForSlot(slot: HandlerSlot): HandlerMeta[] {
    return HANDLER_META.filter((m) => m.slots.includes(slot));
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

/**
 * `itemAction` handlers valid for one `ItemType`.
 *
 * Returns an empty list for `Consumable` — see the note on `itemTypes`:
 * `ActionType` has no Consumable member, so a consumable has no use action to
 * dispatch and must stay metadata-only.
 */
export function itemActionHandlersFor(itemType: string | undefined): HandlerMeta[] {
    const t = itemType ?? "";
    // Consumable is rejected outright rather than filtered: there is no
    // ActionType for it, so *no* handler can ever be dispatched — including
    // `noop`, which is otherwise offered everywhere.
    if (t.toLowerCase() === "consumable") return [];
    return handlersForSlot("itemAction").filter((m) => !m.itemTypes || m.itemTypes.includes(t));
}

export const HANDLER_SLOT_LABELS: Record<HandlerSlot, string> = {
    signal: "Signals (structure click)",
    trigger: "Triggers (timed)",
    processing: "Processing (process step)",
    projectile: "Projectiles (getOptions)",
    upgrade: "Upgrades / research",
    modifier: "Hook modifiers",
    itemAction: "Items (handleAction)",
};

export const HANDLER_SCOPES = Object.keys(HANDLER_SCOPE_LABELS) as HandlerScope[];

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Check a parameter bag against a handler's declared params.
 * Returns human-readable problems; empty means valid.
 */
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
        if (spec.kind === "select" && spec.options && !spec.options.some((o) => o.value === raw)) {
            errs.push(
                `${spec.label} must be one of: ${spec.options.map((o) => o.value).join(", ")}`,
            );
        }
    }
    return errs;
}

/** Turn a validated form bag into a typed `options` object (numbers → numbers). */
/**
 * The handler types a set of keys actually covers.
 *
 * Every slot picker already filters to the handlers that are legal for it, but
 * a filtered dropdown does not say *why* it is short. Naming the types turns
 * "there is nothing to pick" from a puzzle into an answer, which is the whole
 * point of the Handlers screen.
 */
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

// ── Reachability (9.5) ───────────────────────────────────────────────────────

/**
 * Tab → the call site its processes run on.
 *
 * Exported so the validator and the widget agree about what a slot is, rather than
 * each keeping its own nine-line copy. The one thing this table must not do is
 * drift from `HANDLER_META.slots`, so a test checks the two against each other.
 */
export const TAB_TO_CALL_SITE: Record<string, HandlerSlot> = {
    signals: "signal",
    triggers: "trigger",
    processing: "processing",
    items: "itemAction",
    projectiles: "projectile",
    upgrades: "upgrade",
    modifiers: "modifier",
};

/** slot → (config array key, field holding the handler key). */
const SLOT_LOCATION: Record<HandlerSlot, [string, string]> = {
    signal: ["signals", "handlerKey"],
    trigger: ["triggers", "handlerKey"],
    processing: ["processing", "handlerKey"],
    projectile: ["projectiles", "getOptionsKey"],
    upgrade: ["upgrades", "handlerKey"],
    modifier: ["modifiers", "handlerKey"],
    itemAction: ["items", "handlerKey"],
};

/** Where a stored `handlerKey` was found. */
export interface HandlerUsage {
    category: string;
    id: string;
    slot: HandlerSlot;
    /**
     * The action this usage is about. A process may hold several, so one entry
     * in the config can produce several usages — one per action — and each is
     * checked on its own.
     */
    key?: string;
}

/**
 * Walk the stored config and find every handler reference, tagging each with the
 * slot it was found in. Drives both the reachability warnings in the editor and
 * the "used by" column in the handler tab.
 *
 * Reads the action **list**, not a single key, so a process built from three
 * actions reports three usages and each is checked on its own. A bare
 * `handlerKey` — the pre-split shape still on disk — is read as a one-action
 * process, so old configs warn identically to new ones.
 */
export function scanHandlerUsage(cfg: Record<string, unknown>): HandlerUsage[] {
    const out: HandlerUsage[] = [];
    for (
        const [slot, [cfgKey]] of Object.entries(SLOT_LOCATION) as [
            HandlerSlot,
            [string, string],
        ][]
    ) {
        const list = cfg[cfgKey];
        if (!Array.isArray(list)) continue;
        for (const e of list as Record<string, unknown>[]) {
            // `actionRefsOf` now reads `actions` **and** every pre-split single-key
            // name — `handlerKey`, `getOptionsKey`, `onUpgradeKey`. This function
            // used to have a fallback for projectile's `getOptionsKey` alongside
            // it, which double-counted that one slot. One reader, no fallback.
            for (const key of actionRefsOf(e as Record<string, unknown>).map((r) => r.key)) {
                out.push({ category: cfgKey, id: String(e.id ?? "?"), slot, key });
            }
        }
    }
    return out;
}

function findKeyForUsage(cfg: Record<string, unknown>, u: HandlerUsage): string {
    const [cfgKey] = SLOT_LOCATION[u.slot];
    const list = (cfg[cfgKey] ?? []) as Record<string, unknown>[];
    const e = list.find((x) => String(x?.id) === u.id);
    if (!e) return "";
    // Prefer the stored key on the usage itself: with a multi-action process the
    // same entry can appear several times, once per action, and re-deriving the
    // key from the entry would report the first action for all of them.
    return u.key ?? actionRefsOf(e)[0]?.key ?? "";
}

/** Keys used in a slot that the handler cannot legally serve. */
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

/** Reverse index: handler key → the config entries that reference it. */
export function usageIndex(cfg: Record<string, unknown>): Record<string, HandlerUsage[]> {
    const idx: Record<string, HandlerUsage[]> = {};
    for (const u of scanHandlerUsage(cfg)) {
        const key = findKeyForUsage(cfg, u);
        if (!key) continue;
        (idx[key] ??= []).push(u);
    }
    return idx;
}
