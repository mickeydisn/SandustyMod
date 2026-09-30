/**
 * The **structure behaviour** object definition.
 *
 * A behaviour is a simulation pass attached to a structure: `conveyor` moves
 * material along a belt, `launcher` throws it. Both payloads live in one nested
 * `definition` object whose shape depends on the kind.
 *
 * ## Where this field list comes from
 *
 * From the engine's own worker handler, which is the only place the options are
 * actually read:
 *
 * ```js
 * registerConveyorType: (env, type, options) => {
 *   // runWith picks the direction list: 'left' → left, anything else → right
 *   if (!options || (options.transportOffset === undefined &&
 *       options.velocity === undefined && options.maxTransportDistance === undefined &&
 *       options.transportHeight === undefined && options.runWith === undefined &&
 *       options.skipQueued === undefined))
 *       return;                       // no options at all → vanilla behaviour
 *   L[type] = {
 *     transportOffset: options.transportOffset ?? { x: 0, y: -1 },
 *     velocity: options.velocity,
 *     maxTransportDistance: options.maxTransportDistance,
 *     transportHeight: options.transportHeight ?? 1,
 *     skipQueued: options.skipQueued,
 *   };
 * }
 * ```
 *
 * Two things in that snippet are load-bearing, and are encoded below as hints:
 *
 *   - **The whole options object is only stored if at least one of the six keys
 *     is present.** A behaviour with a structure id and nothing else registers a
 *     conveyor with *no* mod overrides, which is not the same as one that asked
 *     for the defaults.
 *   - **`runWith` defaults to right.** `'left'` goes left and *everything else* —
 *     including an absent value — goes right, so a blank field is not neutral.
 *
 * The published `sandkit` types agree field for field
 * (`sandkit/api/structureBehaviors.d.ts`). The launcher tuple is the one place
 * the two kinds differ in shape: a conveyor's `velocity` is a `{x, y}` object,
 * a launcher's is a `[x, y]` tuple.
 */
import { listStructures } from "../../../catalog.ts";
import { idField } from "../fields.ts";
import { parseObjectOrUndefined } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldKind, FieldSpec } from "../types.ts";

/** The kinds — there is no third one, which is why this is a two-item list. */
const KINDS = [
    { value: "conveyor", label: "conveyor" },
    { value: "launcher", label: "launcher" },
];

/** `runWith`. The blank is real, so it is offered rather than implied. */
const RUN_WITH = [
    { value: "right", label: "right" },
    { value: "left", label: "left" },
];

/** True for a launcher, the only kind with three structure ids. */
const isLauncher = (f: Record<string, string>) => f.kind === "launcher";
/** Everything else is a conveyor, including an unchosen kind. */
const isConveyor = (f: Record<string, string>) => !isLauncher(f);

/**
 * One engine option: the control that edits it, and the `definition` key it
 * lands on.
 *
 * `type` is the round-trip accessor, which is *not* the same as the widget
 * `kind` — `structureId` is a `select` widget holding a plain string, and
 * `transportOffset` is a `json` widget that yields a whole object. Keeping both
 * in one row is what stops the widget and the stored value disagreeing.
 */
interface Opt {
    /** The form control's key. */
    control: string;
    /** The key inside `definition` the engine reads. */
    key: string;
    /** How it is read out of / written into an entry. */
    type: "str" | "num" | "json" | "bool";
    /** Everything below is the FieldSpec for the control. */
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

/** `registerConveyorType(structureId, options)` — all six documented options. */
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
        // Deliberately no `def`. The field is tri-state, because the engine's
        // own test is `=== undefined`, not falsy: absent and `false` both mean
        // "do not skip", but only `false` counts as *an option being set*, which
        // is what makes the worker store the whole options object (and apply its
        // `{x:0,y:-1}` / `1` defaults). Giving the control a "false" default
        // would make every conveyor write `skipQueued: false` and silently
        // opt into that, so the blank is the honest starting state.
        when: isConveyor,
        hint: "pass over cells that are already queued instead of stopping at them. " +
            "blank and off both skip nothing, but only a written value counts as an option",
    },
];

/** `registerLauncherType(definition)` — the three ids plus its own three. */
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
        // A tuple here, not the conveyor's {x, y}. The engine reads both under
        // the same name, so getting this wrong type-checks and then does nothing.
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

/**
 * Every `definition` key a control owns.
 *
 * Derived from the two tables rather than written out, so adding an option to
 * either one cannot leave the raw box also carrying it — which is how a key ends
 * up written twice, once from a control and once from the JSON text, with no way
 * to tell which one won.
 */
const OWNED = new Set([...CONVEYOR_OPTS, ...LAUNCHER_OPTS].map((o) => o.key));

/** A control's FieldSpec: its table row, minus the round-trip bookkeeping. */
function toField(o: Opt): FieldSpec {
    const { control, key: _key, type: _type, ...rest } = o;
    return { key: control, ...rest } as FieldSpec;
}

/** The options of one kind, by the kind the form currently holds. */
function optsForKind(kind: string | undefined): Opt[] {
    return kind === "launcher" ? LAUNCHER_OPTS : CONVEYOR_OPTS;
}

// ── The schema ───────────────────────────────────────────────────────────────

/**
 * Built from the two option tables rather than hand-listed.
 *
 * One table drives the widgets, the read-out and the write-in, so a control
 * cannot exist without a round trip, or a round trip without a control. The
 * previous version listed the four structure-id controls by hand and merged them
 * in with a hand-written destructure that had to be kept in step with them — and
 * the six conveyor options were absent from both.
 */
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
        // Whatever the tables do not name, so a key this build does not know
        // about is still expressible. The named options are merged in first and
        // anything typed here wins, which is what keeps this a catch-all rather
        // than a second source of truth for the same keys.
        //
        // Its own "Payload" section, not "Behaviour" again. It is declared last,
        // after the Conveyor and Launcher blocks, so sharing the section name
        // with `kind` at the top made the panel draw "Behaviour" twice with the
        // Conveyor and Launcher tables wedged between them. It stays last on
        // purpose: the hint below refers to "the options above".
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

// ── Round trip ───────────────────────────────────────────────────────────────

/** Read one option out of `definition` as the form text its control holds. */
function readOpt(def: Record<string, unknown>, o: Opt, read: EntryReader): string | undefined {
    switch (o.type) {
        case "str":
            return read.str(def[o.key]);
        case "num":
            return read.num(def[o.key]);
        case "json":
            return read.json(def[o.key]);
        case "bool":
            // Only a `true` is lifted. A Yes/No control cannot tell an explicit
            // `false` from a blank one, so lifting it and writing it back would
            // drop it; `entryToForm` leaves it in the raw box instead, which is
            // the one place it survives a save. Both mean "do not skip", but the
            // engine tests `=== undefined`, so only the written one counts as an
            // option being set.
            return def[o.key] === true ? "true" : undefined;
    }
}

/** The one option's form text, as the value the engine should store. */
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

/** Stored entry → form strings, for the whole behaviour. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("kind", read.str(e.kind));
    // Every option of *both* kinds is lifted out of `definition` into its own
    // control, not just the chosen kind's. The `when` gates hide the other kind's
    // controls, but the values are still read — otherwise switching kind and back
    // would silently discard what was entered for the other one.
    const def = (e.definition ?? {}) as Record<string, unknown>;
    for (const o of [...CONVEYOR_OPTS, ...LAUNCHER_OPTS]) {
        read.put(o.control, readOpt(def, o, read));
    }
    // Anything a control does not own is the raw box. Walked over `def`'s own
    // keys rather than over the tables, so a key with no control still arrives
    // here — the previous version destructured a fixed key list, which is how a
    // key could be in the form and in the raw box at once with nothing to say
    // which one the engine would read.
    const leftover: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(def)) {
        // Kept when no control owns the key — and also when one does but cannot
        // represent the value, which today means a literal `false` in a Yes/No
        // control. Without that second clause an explicit `false` would be lifted
        // into the control, come back as a blank, and be dropped on the next save.
        if (!OWNED.has(k) || v === false) leftover[k] = v;
    }
    read.put("definitionJson", read.json(Object.keys(leftover).length > 0 ? leftover : undefined));
}

/** Form strings → stored entry, for the whole behaviour. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    const kind = w.opt("kind");
    w.setStr("kind", kind);
    // The raw box is merged in first, so it wins over the controls: an unmodelled
    // key stays expressible, and a hand-written `definition` that disagrees with a
    // control is not silently rewritten.
    const def: Record<string, unknown> = {
        ...(parseObjectOrUndefined(form.definitionJson) ?? {}),
    };
    // Only the chosen kind's options. A conveyor must not keep `upType` just
    // because the form still holds one from before a kind switch — the engine
    // would read it as a launcher field on a conveyor.
    for (const o of optsForKind(kind)) {
        const v = writeOpt(w, o);
        if (v === undefined) continue;
        // A blank Yes/No control reads as `false`, and `false` is
        // indistinguishable from "not set" in a form. Writing it would add a key
        // to an entry that never had one — and for a conveyor that is not
        // cosmetic: one present option is what makes the worker store the whole
        // options object. An explicit `false` is kept in the raw box above, which
        // is the only way to say it on purpose.
        if (o.type === "bool" && v === false) continue;
        // `0` is a value, not an absence. A truthiness test here would drop
        // `softDropVelocity: 0`, and the engine's `?? 1` would then replace it.
        def[o.key] = v;
    }
    // An empty payload is left off entirely rather than written as `{}`, which
    // the engine would read as "a behaviour with an empty definition".
    if (Object.keys(def).length > 0) w.setRaw("definition", def);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `definition` is the stored key; every `control` in the tables above is a
 * *control* for it, so they are deliberately absent — claiming them would leave
 * the real key falling through the passthrough as a duplicate of something the
 * form already writes.
 */
const FORM_COVERED = ["kind", "definition"];

export const behaviorDefinition: Definition = {
    tab: "behaviors",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    // No `validate` and no `panel`: every field is a dropdown, a number, a
    // checkbox or a JSON box, and the kind's own requirements are per-field
    // `required` plus `when` gates.
};
