import { listElements, listRecipeMachines } from "../../../catalog.ts";
import { type RecipeOutputEntry } from "../../../constants.ts";
import * as S from "../../styles.ts";
import { advField, elSelect, idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";

const SINGLE_OUTPUT_MACHINES = ["planterBox"];

const isShaker = (f: Record<string, string>) => f.machine === "shaker";

const isSingleOutput = (f: Record<string, string>) => SINGLE_OUTPUT_MACHINES.includes(f.machine);

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

function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("machine", read.str(e.kind));
    read.put("input", read.str(e.input) ?? read.num(e.input));

    read.put("outputElement", read.str(e.output) ?? read.num(e.output));
    read.put("outputChance", read.num(e.chance));
    read.put("outputs", read.json(e.outputs));
    read.put("outputsAbove", read.json(e.outputsAbove));
    read.put("outputsBelow", read.json(e.outputsBelow));
    read.put("minVelocity", read.num(e.minimumDownwardVelocity));
}

function formToEntry(_form: Record<string, string>, w: EntryWriter): void {
    w.setStr("kind", w.opt("machine"));
    w.setStr("input", w.opt("input"));
    w.setStr("output", w.opt("outputElement"));
    w.setNum("chance", w.optNum("outputChance"));

    const outs = w.optJson<RecipeOutputEntry[]>("outputs");
    if (outs) w.setRaw("outputs", outs);
    const above = w.optJson<RecipeOutputEntry[]>("outputsAbove");
    if (above) w.setRaw("outputsAbove", above);
    const below = w.optJson<RecipeOutputEntry[]>("outputsBelow");
    if (below) w.setRaw("outputsBelow", below);
    w.setNum("minimumDownwardVelocity", w.optNum("minVelocity"));
}

function renderOutputs(ctx: FieldContext): unknown {
    const { h, field, value, locked, setField } = ctx;
    const style = ctx.error ? S.inputError : S.input;
    let rows: { elementType?: string; chance?: number }[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch {}
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

function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind !== "outputs") return undefined;

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

function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind !== "outputs") return null;
    return renderOutputs(ctx);
}

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

    panel: { renderField },
};
