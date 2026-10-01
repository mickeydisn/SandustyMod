
import { idField, numField, textField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";


const isNumber = (f: Record<string, string>) => f.type === "number";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("path", "Path", "Identity", true, {
        maxLength: 120,
        hint:
            "where the value lives — `counters.digs`, `players[0].score`. Shared by every process in this mod.",
    }),
    {
        key: "type",
        label: "Type",
        kind: "select",
        section: "Identity",
        required: true,
        def: "number",
        options: [
            { value: "number", label: "number — an integer counter, clamped to min/max" },
            { value: "bool", label: "bool — true / false" },
            { value: "string", label: "string — free text" },
        ],
        hint: "a number is an atomic counter: clamped, and safe to add to from several threads",
    },
    textField("default", "Default", "Value", true, {
        maxLength: 200,
        hint: "what the slot holds until something writes to it",
    }),
    
    numField("min", "Min", "Bounds", {
        when: isNumber,
        hint: "the counter will not go below this",
    }),
    numField("max", "Max", "Bounds", {
        when: isNumber,
        hint: "the counter will not go above this",
    }),
];




function readValue(v: unknown): string | undefined {
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "boolean") return String(v);
    return undefined;
}


function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("path", read.str(e.path));
    read.put("type", read.str(e.type));
    read.put("default", readValue(e.default));
    read.put("min", read.num(e.min));
    read.put("max", read.num(e.max));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("path", w.opt("path"));
    w.setStr("type", w.opt("type"));
    if (form.type === "number") {
        
        
        
        w.setNum("default", w.optNum("default"));
        w.setNum("min", w.optNum("min"));
        w.setNum("max", w.optNum("max"));
    } else {
        w.setStr("default", w.opt("default"));
        
        
        
        
        
        w.del("min");
        w.del("max");
    }
}



export const bufferDefinition: Definition = {
    tab: "buffers",
    fields: FIELDS,
    formCovered: ["path", "type", "default", "min", "max"],
    entryToForm,
    formToEntry,
    
    validate(form) {
        const path = (form.path ?? "").trim();
        if (!path) return { path: "a path is required" };
        if (form.type === "number") {
            const min = Number(form.min);
            const max = Number(form.max);
            if (form.min === "" || Number.isNaN(min)) return { min: "a number slot needs a min" };
            if (form.max === "" || Number.isNaN(max)) return { max: "a number slot needs a max" };
            if (min > max) return { min: `min is above max (${max})` };
        }
        return {};
    },
};
