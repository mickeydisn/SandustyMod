/**
 * The **buffer slot** object definition.
 *
 * A slot the author's processes agree on: a path, a type, a value to start from,
 * and — for a number — the two bounds it is clamped between. The game never
 * registers it. What exists at run time is a shared `Int32Array` and a slice of
 * shared JSON, and the only things that name one are the three `buffer*` actions.
 *
 * ## Why this is a `custom/` object
 *
 * Because the engine has never heard of it. A structure, a projectile and a
 * recipe are all things `register()` receives; a slot is not a thing at all, it
 * is an address. The same test `network.ts` applies — "is this a word the game
 * already knows" — puts this beside it rather than among the engine objects.
 *
 * ## Why `min`/`max` are required for a number
 *
 * A numeric slot is backed by an atomic counter, and the counter is *clamped*.
 * An unbounded number has nothing to clamp to, so it is not a slot with a
 * generous range, it is an error — `JsonMapBuffer` throws in its constructor.
 * Defaulting the bounds would hide that, so the two fields only appear for a
 * number and are required when they do. The `when` predicates below are the
 * whole of that rule, and the runtime re-checks it in `planSlot`.
 *
 * ## Why `default` is a plain text field for all three types
 *
 * Because it is stored as one. A `number` reads back as an integer counter, a
 * `bool` as `true`/`false` and a `string` as whatever was typed, and giving each
 * its own widget would mean three form keys and a reader that branched. The value
 * is coerced against `type` on load, which is why a `bool` typed as `true` and
 * one typed as `"true"` behave the same.
 *
 * Ground truth: `packages/buffer/README.md` and `src/json-map-buffer.ts`.
 */
import { idField, numField, textField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";

/** True for a slot the buffer backs with an atomic counter. */
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
    // The two bounds, and they exist only for a number. See the note above.
    numField("min", "Min", "Bounds", {
        when: isNumber,
        hint: "the counter will not go below this",
    }),
    numField("max", "Max", "Bounds", {
        when: isNumber,
        hint: "the counter will not go above this",
    }),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("path", read.str(e.path));
    read.put("type", read.str(e.type));
    read.put("default", read.str(e.default));
    read.put("min", read.str(e.min));
    read.put("max", read.str(e.max));
}

/**
 * Form strings → stored entry.
 *
 * `min`/`max` are written **only** for a number, and written as numbers. A form
 * stores every field as a string, so writing them raw would store `"0"` and the
 * clamp would then compare a string to a number — which in JavaScript sorts
 * `"" < 0` and silently clamps every slot to its minimum. `Number(...)` is what
 * makes the stored entry the shape `JsonMapBuffer` asks for.
 */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("path", w.opt("path"));
    w.setStr("type", w.opt("type"));
    w.setStr("default", w.opt("default"));
    if (form.type === "number") {
        w.setNum("min", w.optNum("min"));
        w.setNum("max", w.optNum("max"));
    } else {
        // Not merely left unwritten. Switching a slot from `number` to `bool` does
        // not re-open the entry, so the old bounds would still be sitting in the
        // stored object — and `planSlot` would go on reading them for a slot that
        // is no longer a counter. `del` is the only thing that loses a key, so
        // this is the only way a field actually goes away.
        w.del("min");
        w.del("max");
    }
}

// ── The definition ───────────────────────────────────────────────────────────

export const bufferDefinition: Definition = {
    tab: "buffers",
    fields: FIELDS,
    formCovered: ["path", "type", "default", "min", "max"],
    entryToForm,
    formToEntry,
    /**
     * The same rules the runtime applies, run on the form.
     *
     * Both, deliberately. This is where the author gets told "a number needs both
     * a min and a max" while they are looking at the row, with Save disabled
     * rather than a surprise at load; `planSlot` is the same rule again, because
     * a config can also arrive by hand-editing the JSON, and the constructor would
     * throw on a slot this had let through. Two checks that agree beat one check
     * that is sometimes skipped.
     */
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
