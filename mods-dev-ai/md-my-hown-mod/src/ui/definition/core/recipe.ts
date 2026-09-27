/**
 * The **recipe** object definition.
 *
 * A recipe is what one of the game's eight built-in machines does with an
 * input: an id (`smelter`, `planterBox`, `kineticPress`, `shaker`, …) plus the
 * outputs that machine produces. The machine id is not decoration — it decides
 * *which* output fields exist. A planterBox takes a single element and a chance;
 * a shaker takes an array above and an array below; a kineticPress additionally
 * requires the input to be falling at a minimum speed. So the schema is a set
 * of `when` predicates over one field, and the save path has to write whichever
 * shape the chosen machine expects.
 *
 * It owns the `outputs` kind outright — the repeating `{ elementType, chance }`
 * row editor, its rules, and the 255-row cap. Nothing else in the panel has
 * that kind, so the generic renderer has no reason to know it.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.recipes.md`.
 */
import { listElements, listRecipeMachines } from "../../../catalog.ts";
import { type RecipeOutputEntry } from "../../../constants.ts";
import * as S from "../../styles.ts";
import { advField, elSelect, idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";

/** Machines whose output is a single element, not a list. */
const SINGLE_OUTPUT_MACHINES = ["planterBox"];

/** Machines that drop one list above the machine and another below it. */
const isShaker = (f: Record<string, string>) => f.machine === "shaker";

/** True when the single-element output controls apply. */
const isSingleOutput = (f: Record<string, string>) => SINGLE_OUTPUT_MACHINES.includes(f.machine);

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        key: "machine",
        label: "Machine",
        kind: "select",
        section: "Recipe",
        required: true,
        options: listRecipeMachines,
        def: "smelter",
        hint: "only these 8 ids are accepted by the engine",
    },
    elSelect("input", "Input element", "Recipe", true),
    {
        key: "outputElement",
        label: "Output element",
        kind: "select",
        section: "Outputs",
        required: true,
        options: listElements,
        when: isSingleOutput,
    },
    numField("outputChance", "Output chance", "Outputs", {
        min: 0,
        max: 1,
        step: 0.05,
        int: false,
        def: "1",
        when: isSingleOutput,
    }),
    {
        key: "outputs",
        label: "Outputs (element + chance)",
        kind: "outputs",
        section: "Outputs",
        required: true,
        wide: true,
        when: (f) => !isSingleOutput(f) && !isShaker(f),
        hint: "chance 0–1, max 255 rows",
    },
    {
        key: "outputsAbove",
        label: "Outputs above",
        kind: "outputs",
        section: "Outputs",
        required: true,
        wide: true,
        when: isShaker,
        hint: "dropped on top of the shaker",
    },
    {
        key: "outputsBelow",
        label: "Outputs below",
        kind: "outputs",
        section: "Outputs",
        required: true,
        wide: true,
        when: isShaker,
        hint: "dropped below the shaker",
    },
    numField("minVelocity", "Min downward velocity", "Outputs", {
        required: true,
        min: 0,
        max: 10000,
        def: "20",
        when: (f) => f.machine === "kineticPress",
        hint: "cells per second the input must fall at",
    }),
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole recipe. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    // Stored as `kind`; the form calls it `machine`, because "kind" reads as a
    // type tag in every other tab and this one is a specific machine id.
    read.put("machine", read.str(e.kind));
    read.put("input", read.str(e.input) ?? read.num(e.input));
    // A single-element machine stores `output` + `chance`; a list machine
    // stores `outputs` and has no `chance`. All of them are read, and the `when`
    // predicates decide which controls that actually shows.
    read.put("outputElement", read.str(e.output) ?? read.num(e.output));
    read.put("outputChance", read.num(e.chance));
    read.put("outputs", read.json(e.outputs));
    read.put("outputsAbove", read.json(e.outputsAbove));
    read.put("outputsBelow", read.json(e.outputsBelow));
    read.put("minVelocity", read.num(e.minimumDownwardVelocity));
}

/**
 * Form strings → stored entry, for the whole recipe.
 *
 * `_form` is unused: every read goes through the writer, which already carries
 * the form. The parameter stays because the `Definition` contract has one
 * signature, so a definition that needs a raw form value the writer does not
 * expose (structure reads `form.tooltipHoverJson` for that) can still ask.
 */
function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("kind", w.opt("machine"));
    w.setStr("input", w.opt("input"));
    w.setStr("output", w.opt("outputElement"));
    w.setNum("chance", w.optNum("outputChance"));
    // Each list is written only if present, and the three are independent: a
    // shaker fills above and below, everyone else fills the one list. Writing
    // whichever is non-empty keeps a machine switch from leaving the previous
    // machine's output array behind as a second, competing source.
    const outs = w.optJson<RecipeOutputEntry[]>("outputs");
    if (outs) w.setRaw("outputs", outs);
    const above = w.optJson<RecipeOutputEntry[]>("outputsAbove");
    if (above) w.setRaw("outputsAbove", above);
    const below = w.optJson<RecipeOutputEntry[]>("outputsBelow");
    if (below) w.setRaw("outputsBelow", below);
    w.setNum("minimumDownwardVelocity", w.optNum("minVelocity"));
}

// ── The outputs row editor ───────────────────────────────────────────────────

/**
 * The repeating `{ elementType, chance }` row editor.
 *
 * `elementType` and `chance` are stored as numbers on the way in and ids on the
 * way out, so the list is a genuine "N of these, each with this probability" —
 * a shape a single select plus a single chance cannot express, and the reason
 * this control exists rather than two more dropdowns.
 */
function renderOutputs(ctx: FieldContext): unknown {
    const { h, field, value, locked, setField } = ctx;
    const style = ctx.error ? S.inputError : S.input;
    let rows: { elementType?: string; chance?: number }[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch { /* raw value stays in the form; validation reports it */ }
    const writeRows = (next: { elementType?: string; chance?: number }[]) =>
        setField(field.key, JSON.stringify(next, null, 2));
    const elements = listElements();

    return h(
        "div",
        null,
        ...rows.map((row, i) =>
            h(
                "div",
                { key: i, style: S.outputsRow },
                h(
                    "select",
                    {
                        style: S.input,
                        value: row.elementType ?? "",
                        disabled: locked,
                        onChange: (e: { target: { value: string } }) =>
                            writeRows(
                                rows.map((r, j) =>
                                    j === i ? { ...r, elementType: e.target.value } : r
                                ),
                            ),
                    },
                    h("option", { value: "" }, "— element —"),
                    ...elements.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                ),
                h("input", {
                    type: "number",
                    style,
                    value: row.chance === undefined ? "1" : String(row.chance),
                    disabled: locked,
                    min: 0,
                    max: 1,
                    step: 0.05,
                    title: "chance 0–1",
                    onChange: (e: { target: { value: string } }) => {
                        writeRows(
                            rows.map((r, j) =>
                                j === i ? { ...r, chance: Number(e.target.value) } : r
                            ),
                        );
                    },
                }),
                h(
                    "button",
                    {
                        style: S.btnDanger,
                        disabled: locked,
                        onClick: () => writeRows(rows.filter((_, j) => j !== i)),
                    },
                    "×",
                ),
            )
        ),
        h(
            "button",
            {
                style: S.btn,
                disabled: locked,
                onClick: () => writeRows([...rows, { elementType: "", chance: 1 }]),
            },
            "+ Add output",
        ),
    );
}

/**
 * Validate one `outputs` row list.
 *
 * These rules live here rather than in the generic validator because only a
 * recipe has an `outputs` list — the engine caps one at 255 rows and requires
 * every row to name an element and a chance in 0–1, none of which the generic
 * `json` rule can know.
 */
function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind !== "outputs") return undefined;
    // An empty list is not a JSON syntax error to report — it is a required
    // list with no rows in it, and "add at least one output" is what the author
    // has to do about it. (An empty textarea parses to nothing, so the check has
    // to come before `JSON.parse` or the message would be about brackets.)
    if (!value.trim()) return "add at least one output";
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (e) {
        return (e as Error).message;
    }
    if (!Array.isArray(parsed)) return "must be an array of { elementType, chance }";
    if (parsed.length === 0) return "add at least one output";
    if (parsed.length > 255) return "max 255 outputs";
    for (const row of parsed) {
        if (!row || typeof row !== "object") return "rows must be objects";
        const r = row as { elementType?: unknown; chance?: unknown };
        if (typeof r.elementType !== "string" || !r.elementType.trim()) {
            return "every row needs an element";
        }
        if (
            typeof r.chance !== "number" || !Number.isFinite(r.chance) || r.chance < 0 ||
            r.chance > 1
        ) {
            return "chance must be a number 0–1";
        }
    }
    return undefined;
}

/**
 * The control for whichever recipe-only kind this field is, or `null` for the
 * generic ones the panel already knows how to draw.
 */
function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind !== "outputs") return null;
    return renderOutputs(ctx);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `outputs`, `outputsAbove` and `outputsBelow` are the stored key names, so
 * they are listed as themselves; `machine`, `outputElement`, `outputChance` and
 * `minVelocity` are *control* names for `kind`, `output`, `chance` and
 * `minimumDownwardVelocity`, and are deliberately absent — claiming them would
 * leave the real keys falling through the passthrough as duplicates.
 */
const FORM_COVERED = [
    "kind",
    "input",
    "output",
    "chance",
    "outputs",
    "outputsAbove",
    "outputsBelow",
    "minimumDownwardVelocity",
];

export const recipeDefinition: Definition = {
    tab: "recipes",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validateField,
    // No `validate`: the machine's own requirements are all per-field — each
    // output control is `required` and gated by a `when` — so there is nothing
    // left that needs two fields at once.
    panel: { renderField },
};
