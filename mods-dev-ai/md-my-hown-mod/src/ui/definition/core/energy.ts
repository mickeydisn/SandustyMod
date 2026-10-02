import { listEnergyNetworkOpts, listStructures } from "../../../catalog.ts";
import { ENERGY_ROLE_OPTS } from "../choices.ts";
import { advField, idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

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
        key: "type",
        label: "Role",
        kind: "select",
        section: "Energy",
        required: true,
        def: "storage",
        options: ENERGY_ROLE_OPTS,
    },
    numField("capacity", "Capacity", "Energy", {
        min: 0,
        max: 1_000_000,
        def: "1000",
        when: (f) => f.type === "storage",
        hint: "max energy this node can hold (api.energy.registerType options.capacity)",
    }),
    {
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

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("structureId", read.str(e.structureId));
    read.put("type", read.str(e.type));

    const o = e.options as
        | { capacity?: number; energyType?: string; priority?: number }
        | undefined;
    read.put("capacity", read.num(o?.capacity));
    read.put("energyType", read.str(o?.energyType));
    read.put("priority", read.num(o?.priority));
}

function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("structureId", w.opt("structureId"));
    w.setStr("type", w.opt("type"));

    const options: Record<string, unknown> = {};
    const cap = w.optNum("capacity");
    if (cap !== undefined) options.capacity = cap;
    const net = w.opt("energyType");
    if (net) options.energyType = net;
    const prio = w.optNum("priority");
    if (prio !== undefined) options.priority = prio;
    if (Object.keys(options).length > 0) w.setRaw("options", options);
}

const FORM_COVERED = ["structureId", "type", "options"];

export const energyDefinition: Definition = {
    tab: "energy",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
};
