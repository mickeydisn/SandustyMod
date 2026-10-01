
import { listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import { parseObjectOrUndefined } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldKind, FieldSpec } from "../types.ts";


const KINDS = [
    { value: "conveyor", label: "conveyor" },
    { value: "launcher", label: "launcher" },
];


const RUN_WITH = [
    { value: "right", label: "right" },
    { value: "left", label: "left" },
];


const isLauncher = (f: Record<string, string>) => f.kind === "launcher";

const isConveyor = (f: Record<string, string>) => !isLauncher(f);


interface Opt {
    
    control: string;
    
    key: string;
    
    type: "str" | "num" | "json" | "bool";
    
    label: string;
    kind: FieldKind;
    section: string;
    required?: boolean;
    hint?: string;
    placeholder?: string;
    options?: FieldSpec["options"];
    jsonType?: FieldSpec["jsonType"];
    def?: string;
    step?: number;
    min?: number;
    wide?: boolean;
    when?: (f: Record<string, string>) => boolean;
}


const CONVEYOR_OPTS: Opt[] = [
    {
        control: "structureId",
        key: "id",
        type: "str",
        label: "Structure",
        kind: "select",
        section: "Conveyor",
        required: true,
        when: isConveyor,
        options: listStructures,
        hint: "the structure type to run as a belt",
    },
    {
        control: "transportOffset",
        key: "transportOffset",
        type: "json",
        label: "Transport offset",
        kind: "json",
        jsonType: "object",
        section: "Conveyor",
        wide: true,
        when: isConveyor,
        placeholder: '{ "x": 0, "y": -1 }',
        hint: "Vector2. engine default {x: 0, y: -1} — which way the grab reaches",
    },
    {
        control: "conveyorVelocity",
        key: "velocity",
        type: "json",
        label: "Velocity",
        kind: "json",
        jsonType: "object",
        section: "Conveyor",
        wide: true,
        when: isConveyor,
        placeholder: '{ "x": 0, "y": 0 }',
        hint: "Vector2, carried onto the moved cells. no engine default",
    },
    {
        control: "maxTransportDistance",
        key: "maxTransportDistance",
        type: "num",
        label: "Max transport distance",
        kind: "number",
        section: "Conveyor",
        when: isConveyor,
        step: 1,
        hint: "how far one pull can reach. no engine default",
    },
    {
        control: "transportHeight",
        key: "transportHeight",
        type: "num",
        label: "Transport height",
        kind: "number",
        section: "Conveyor",
        when: isConveyor,
        step: 1,
        hint: "engine default 1",
    },
    {
        control: "runWith",
        key: "runWith",
        type: "str",
        label: "Run with",
        kind: "select",
        section: "Conveyor",
        when: isConveyor,
        options: RUN_WITH,
        hint: "which direction list this type joins. blank means right, not neutral",
    },
    {
        control: "skipQueued",
        key: "skipQueued",
        type: "bool",
        label: "Skip queued",
        kind: "bool",
        section: "Conveyor",
        
        
        
        
        
        
        
        when: isConveyor,
        hint: "pass over cells that are already queued instead of stopping at them. " +
            "blank and off both skip nothing, but only a written value counts as an option",
    },
];


const LAUNCHER_OPTS: Opt[] = [
    {
        control: "upType",
        key: "upType",
        type: "str",
        label: "Up structure",
        kind: "select",
        section: "Launcher",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        control: "leftType",
        key: "leftType",
        type: "str",
        label: "Left structure",
        kind: "select",
        section: "Launcher",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        control: "rightType",
        key: "rightType",
        type: "str",
        label: "Right structure",
        kind: "select",
        section: "Launcher",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        control: "launcherVelocity",
        key: "velocity",
        type: "json",
        label: "Launch velocity",
        kind: "json",
        jsonType: "array",
        section: "Launcher",
        wide: true,
        when: isLauncher,
        placeholder: "[ 0, -1 ]",
        
        
        hint: "[x, y] tuple — a conveyor's velocity is a {x, y} object instead",
    },
    {
        control: "softDropVelocity",
        key: "softDropVelocity",
        type: "num",
        label: "Soft drop velocity",
        kind: "number",
        section: "Launcher",
        when: isLauncher,
        step: 0.1,
        hint: "fallback speed when the launch cannot carry the cell",
    },
    {
        control: "runTickSharedBufferKey",
        key: "runTickSharedBufferKey",
        type: "str",
        label: "Run-tick buffer key",
        kind: "text",
        section: "Launcher",
        when: isLauncher,
        hint: "optional shared-buffer key for the run tick",
    },
];


const OWNED = new Set([...CONVEYOR_OPTS, ...LAUNCHER_OPTS].map((o) => o.key));


function toField(o: Opt): FieldSpec {
    const { control, key: _key, type: _type, ...rest } = o;
    return { key: control, ...rest } as FieldSpec;
}


function optsForKind(kind: string | undefined): Opt[] {
    return kind === "launcher" ? LAUNCHER_OPTS : CONVEYOR_OPTS;
}




const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "kind",
        label: "Kind",
        kind: "select",
        section: "Behaviour",
        required: true,
        def: "conveyor",
        options: KINDS,
        hint: "which simulation pass this joins — there is no third one",
    },
    ...CONVEYOR_OPTS.map(toField),
    ...LAUNCHER_OPTS.map(toField),
    {
        
        
        
        
        
        
        
        
        
        
        key: "definitionJson",
        label: "Rest of the payload",
        kind: "json",
        section: "Payload",
        jsonType: "object",
        wide: true,
        hint:
            "any other key, forwarded untouched. The options above are merged in; anything here wins over them.",
        placeholder: "{ }",
    },
];




function readOpt(def: Record<string, unknown>, o: Opt, read: EntryReader): string | undefined {
    switch (o.type) {
        case "str":
            return read.str(def[o.key]);
        case "num":
            return read.num(def[o.key]);
        case "json":
            return read.json(def[o.key]);
        case "bool":
            
            
            
            
            
            
            return def[o.key] === true ? "true" : undefined;
    }
}


function writeOpt(w: EntryWriter, o: Opt): unknown {
    switch (o.type) {
        case "str":
            return w.opt(o.control);
        case "num":
            return w.optNum(o.control);
        case "json":
            return w.optJson(o.control);
        case "bool":
            return w.optBool(o.control);
    }
}


function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("kind", read.str(e.kind));
    
    
    
    
    const def = (e.definition ?? {}) as Record<string, unknown>;
    for (const o of [...CONVEYOR_OPTS, ...LAUNCHER_OPTS]) {
        read.put(o.control, readOpt(def, o, read));
    }
    
    
    
    
    
    const leftover: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(def)) {
        
        
        
        
        if (!OWNED.has(k) || v === false) leftover[k] = v;
    }
    read.put("definitionJson", read.json(Object.keys(leftover).length > 0 ? leftover : undefined));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    const kind = w.opt("kind");
    w.setStr("kind", kind);
    
    
    
    const def: Record<string, unknown> = {
        ...(parseObjectOrUndefined(form.definitionJson) ?? {}),
    };
    
    
    
    for (const o of optsForKind(kind)) {
        const v = writeOpt(w, o);
        if (v === undefined) continue;
        
        
        
        
        
        
        if (o.type === "bool" && v === false) continue;
        
        
        def[o.key] = v;
    }
    
    
    if (Object.keys(def).length > 0) w.setRaw("definition", def);
}




const FORM_COVERED = ["kind", "definition"];

export const behaviorDefinition: Definition = {
    tab: "behaviors",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
};
