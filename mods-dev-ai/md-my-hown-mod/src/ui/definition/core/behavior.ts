/**
 * The **structure behaviour** object definition.
 *
 * A behaviour is a simulation pass attached to a structure: `conveyor` pushes
 * material along, `launcher` throws it. The engine's payload for both lives in
 * one nested `definition` object, and its *shape* depends on the kind — a
 * conveyor is registered against a single structure (`definition.id`), a launcher
 * against three under the fixed names `upType` / `leftType` / `rightType`.
 *
 * So the form gives each of those its own picker and merges them back into the
 * nested object on save. What it cannot do is name everything the engine reads,
 * so the `definitionJson` box exists alongside: the named ids are merged in
 * first and anything typed there wins, which keeps an unmodellable key
 * expressible without pretending the four pickers are the whole payload.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.structureBehaviors.md`.
 */
import { listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import { parseObjectOrUndefined } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

/** The kinds — there is no third one, which is why this is a two-item list. */
const KINDS = [
    { value: "conveyor", label: "conveyor" },
    { value: "launcher", label: "launcher" },
];

/** The launcher names its three structures; a conveyor names one. */
const LAUNCHER_KEYS = ["upType", "leftType", "rightType"] as const;

/** True for a launcher, which is the only kind with three structure ids. */
const isLauncher = (f: Record<string, string>) => f.kind === "launcher";

// ── The schema ───────────────────────────────────────────────────────────────

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
    // The structure ids live inside `definition` because that is the shape the
    // engine wants, but each is its own control here and each is merged in on
    // the way out. A conveyor is registered against a single structure
    // (`definition.id`); a launcher against three, under exactly the names the
    // engine uses.
    {
        key: "structureId",
        label: "Structure",
        kind: "select",
        section: "Behaviour",
        required: true,
        when: (f) => !isLauncher(f),
        options: listStructures,
    },
    {
        key: "upType",
        label: "Up structure",
        kind: "select",
        section: "Behaviour",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        key: "leftType",
        label: "Left structure",
        kind: "select",
        section: "Behaviour",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        key: "rightType",
        label: "Right structure",
        kind: "select",
        section: "Behaviour",
        required: true,
        when: isLauncher,
        options: listStructures,
    },
    {
        // Whatever the engine reads that the four controls above do not name.
        // The named ids are merged in on save, and anything typed here wins
        // over them — so an unmodellable key is still expressible.
        key: "definitionJson",
        label: "Rest of the payload",
        kind: "json",
        section: "Behaviour",
        jsonType: "object",
        wide: true,
        hint:
            "everything else, forwarded to structureBehaviors.register*. The structure ids above are merged in; anything here wins over them.",
        placeholder: "{ }",
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole behaviour. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("kind", read.str(e.kind));
    // The named structure ids are their own controls, but they live inside
    // `definition` — so they are lifted out for the pickers. What is left over
    // is the raw box, and it keeps every key the four controls do not name.
    const def = (e.definition ?? {}) as Record<string, unknown>;
    read.put("structureId", read.str(def.id));
    read.put("upType", read.str(def.upType));
    read.put("leftType", read.str(def.leftType));
    read.put("rightType", read.str(def.rightType));
    const { id: _id, upType: _up, leftType: _l, rightType: _r, ...rest } = def;
    read.put("definitionJson", read.json(Object.keys(rest).length > 0 ? rest : undefined));
}

/** Form strings → stored entry, for the whole behaviour. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("kind", w.opt("kind"));
    // The named ids are merged in first, so the raw box wins over them: an
    // unmodellable key stays expressible, and a hand-written `definition` that
    // disagrees with the pickers is not silently rewritten.
    const def: Record<string, unknown> = {
        ...(parseObjectOrUndefined(form.definitionJson) ?? {}),
    };
    // Only the keys that belong to the chosen kind. A conveyor does not write
    // `upType` even if the form still holds one from before a kind switch.
    if (w.opt("kind") === "launcher") {
        for (const key of LAUNCHER_KEYS) {
            const v = w.opt(key);
            if (v) def[key] = v;
        }
    } else {
        const id = w.opt("structureId");
        if (id) def.id = id;
    }
    // An empty payload is left off entirely rather than written as `{}`, which
    // the engine would read as "a behaviour with an empty definition".
    if (Object.keys(def).length > 0) w.setRaw("definition", def);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `definition` is the stored key; `structureId`, `upType`, `leftType`,
 * `rightType` and `definitionJson` are the *controls* for it, so they are
 * deliberately absent — claiming them would leave the real key falling through
 * the passthrough as a duplicate of something the form already writes.
 */
const FORM_COVERED = ["kind", "definition"];

export const behaviorDefinition: Definition = {
    tab: "behaviors",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every field is a dropdown or a JSON box, and
    // the kind's own requirements are per-field `required` plus `when` gates.
};
