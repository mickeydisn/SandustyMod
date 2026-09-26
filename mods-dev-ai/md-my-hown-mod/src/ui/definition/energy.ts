/**
 * The **energy type** object definition.
 *
 * A placed structure is declared to the energy system as one of exactly two
 * roles, with three optional options behind them. There is no third role: making
 * or spending energy is a *processor handler's* job, not a property of the
 * structure, so a "producer" here would be a promise the engine never keeps.
 *
 * The `capacity` control is conditional on the role rather than merely
 * discouraged, because a conductor that holds energy is a different thing from
 * one that does not, and the engine's own hint on the role says as much.
 *
 * `options` is a real nested object in `registerType`, so the three controls are
 * merged into it on the way out and lifted back out on the way in. The merge is
 * deliberately "only if non-empty": an entry with no options is a valid
 * registration, and writing `options: {}` instead would be a different object.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.energy.md`.
 */
import { listEnergyNetworkOpts, listStructures } from "../../catalog.ts";
import { advField, idField, numField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "structureId",
        label: "Structure",
        kind: "select",
        section: "Energy",
        required: true,
        options: listStructures,
    },
    {
        // api.energy.registerType(structureId, type, options?) accepts exactly
        // two roles: "conductor" (forwards energy) and "storage" (holds it).
        // There is no producer/consumer role — producing or consuming energy is
        // done by a processor handler calling addAtCell / consume.
        key: "type",
        label: "Role",
        kind: "select",
        section: "Energy",
        required: true,
        def: "storage",
        options: [
            { value: "storage", label: "storage — holds energy (needs a capacity)" },
            { value: "conductor", label: "conductor — forwards energy, holds nothing" },
        ],
    },
    numField("capacity", "Capacity", "Energy", {
        min: 0,
        max: 1_000_000,
        def: "1000",
        when: (f) => f.type === "storage",
        hint: "max energy this node can hold (api.energy.registerType options.capacity)",
    }),
    {
        // A closed set in the engine, but one the game gives us no way to
        // enumerate — `options.energyType` is a bare string and nothing in the
        // api lists the channels. That is exactly why this is a picker over
        // *our* config plus the engine's own default: a typo here registers
        // cleanly and the node then never joins anything, looking configured
        // and doing nothing.
        key: "energyType",
        label: "Network",
        kind: "select",
        section: "Energy",
        options: listEnergyNetworkOpts,
        hint: 'options.energyType — which network to join. The engine\'s default is "power".',
    },
    numField("priority", "Priority", "Energy", {
        min: 0,
        max: 1000,
        def: "0",
        when: () => true,
        hint: "network priority (only read by the engine if it supports it)",
    }),
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole energy type. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("structureId", read.str(e.structureId));
    read.put("type", read.str(e.type));
    // Documented registerType options: capacity (storage) + energyType.
    const o = e.options as
        | { capacity?: number; energyType?: string; priority?: number }
        | undefined;
    read.put("capacity", read.num(o?.capacity));
    read.put("energyType", read.str(o?.energyType));
    read.put("priority", read.num(o?.priority));
}

/** Form strings → stored entry, for the whole energy type. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureId", w.opt("structureId"));
    w.setStr("type", w.opt("type"));
    // Three controls, one stored object. Only keys the author actually filled
    // are written, so an entry with no options stays a bare registration rather
    // than becoming `options: {}`.
    const options: Record<string, unknown> = {};
    const cap = w.optNum("capacity");
    if (cap !== undefined) options.capacity = cap;
    const net = w.opt("energyType");
    if (net) options.energyType = net;
    const prio = w.optNum("priority");
    if (prio !== undefined) options.priority = prio;
    if (Object.keys(options).length > 0) w.setRaw("options", options);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `options` is the stored key; `capacity`, `energyType` and `priority` are the
 * *controls* for it and are deliberately absent, so the real key does not also
 * fall through the passthrough as a duplicate.
 */
const FORM_COVERED = ["structureId", "type", "options"];

export const energyDefinition: Definition = {
    tab: "energy",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: a dropdown, a number and a JSON-free trio.
    // The one thing worth noting is `priority`: the engine reads it only if it
    // supports the concept, so there is no rule to assert about it and the hint
    // says so instead of pretending otherwise.
};
