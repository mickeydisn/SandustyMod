



const FIELDS: FieldSpec[] = [
    idField(),
    
    
    
    excavationOptionField(),
    numField("power", "Power", "Profile", {
        required: true,
        min: 0,
        max: 1000,
        def: "10",
        
        
        
        when: (f) => !(f[OPTIONS_FORM_KEY] ?? "").trim(),
    }),
    {
        key: PARAMS_FORM_KEY,
        label: "Option parameters",
        kind: "json",
        section: "Profile",
        jsonType: "object",
        
        
        
        
        when: () => false,
    },
    {
        key: "patternJson",
        label: "Pattern",
        kind: "json",
        section: "Profile",
        required: true,
        jsonType: "matrix",
        wide: true,
        hint: "cells removed per dig — 1 = dug, 0 = kept",
        placeholder: "[[1, 1], [1, 1]]",
    },
    {
        key: "terrainRulesJson",
        label: "Terrain rules",
        kind: "terrainRules",
        section: "Profile",
        wide: true,
        hint: "per-terrain dig behaviour: which terrain matches, how much damage, what it drops",
    },
    {
        key: "optionsJson",
        label: "Options",
        kind: "json",
        section: "Profile",
        jsonType: "object",
        wide: true,
        
        
        when: (f) => !(f[OPTIONS_FORM_KEY] ?? "").trim(),
        hint: "{ fromGun?, fromDrill?, drillTierDamage? (0–1000), forceRemoveAll?, … }",
        placeholder: '{ "fromDrill": true }',
    },
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("power", read.num(e.power));
    readExcavationOption(read, e);
    read.put("patternJson", read.json(e.pattern));
    read.put("terrainRulesJson", read.json(e.terrainRules));
    read.put("optionsJson", read.json(e.options));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    writeExcavationOption(w);
    w.setNum("power", w.optNum("power"));
    const pattern = w.optJson<number[][]>("patternJson");
    if (pattern) w.setRaw("pattern", pattern);
    
    
    
    const rules = w.optJson<Record<string, unknown>[]>("terrainRulesJson");
    if (rules && rules.length > 0) w.setRaw("terrainRules", rules);
    const options = w.optJson<Record<string, unknown>>("optionsJson");
    if (options) w.setRaw("options", options);
}




function renderTerrainRules(ctx: FieldContext): unknown {
    const { h, field, value, setField } = ctx;
    let rows: Record<string, unknown>[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch {  }
    const writeRows = (next: Record<string, unknown>[]) =>
        setField(field.key, JSON.stringify(next, null, 2));
    const terrains = listTerrains();
    const elements = listElements();
    const drop = (cellType: unknown) => cellType === undefined ? undefined : String(cellType);

    return h(
        "div",
        null,
        rows.length === 0
            ? h(
                "div",
                { style: S.hintBelow },
                "No rules — this profile treats every terrain the same.",
            )
            : null,
        ...rows.map((row, i) =>
            h(
                "div",
                { key: i, style: S.outputsRow },
                h(
                    "select",
                    {
                        style: S.input,
                        title: "terrain matched by this rule",
                        value: drop(row.cellType) ?? "",
                        onChange: (e: { target: { value: string } }) =>
                            writeRows(
                                rows.map((r, j) =>
                                    j === i ? { ...r, cellType: e.target.value } : r
                                ),
                            ),
                    },
                    h("option", { value: "" }, "— terrain —"),
                    ...terrains.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                ),
                h("input", {
                    type: "number",
                    style: S.input,
                    value: row.damage === undefined ? "" : String(row.damage),
                    placeholder: "damage",
                    title: "damage applied when this terrain matches (optional)",
                    onChange: (e: { target: { value: string } }) => {
                        const v = e.target.value;
                        writeRows(
                            rows.map((r, j) => {
                                if (j !== i) return r;
                                const next = { ...r };
                                if (v === "") delete next.damage;
                                else next.damage = Number(v);
                                return next;
                            }),
                        );
                    },
                }),
                h(
                    "select",
                    {
                        style: S.input,
                        title: "element produced when dug",
                        value: drop(row.outputElementType) ?? "",
                        onChange: (e: { target: { value: string } }) => {
                            const v = e.target.value;
                            writeRows(
                                rows.map((r, j) => {
                                    if (j !== i) return r;
                                    const next = { ...r };
                                    if (v === "") delete next.outputElementType;
                                    else next.outputElementType = v;
                                    return next;
                                }),
                            );
                        },
                    },
                    h("option", { value: "" }, "— drop —"),
                    ...elements.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                ),
                h(
                    "button",
                    {
                        style: S.btnDanger,
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
                onClick: () => writeRows([...rows, { cellType: "" }]),
            },
            "+ Add terrain rule",
        ),
        ctx.error ? h("div", { style: S.errorText }, ctx.error) : null,
    );
}


function validateMatrix(value: unknown): string | undefined {
    if (!Array.isArray(value) || value.length === 0) {
        return "must be a non-empty array of rows";
    }
    const width = Array.isArray(value[0]) ? value[0].length : -1;
    if (width <= 0) return "rows must be non-empty arrays";
    for (const row of value) {
        if (!Array.isArray(row)) return "every row must be an array";
        if (row.length !== width) return "rows must all be the same length";
        for (const cell of row) {
            if (cell !== 0 && cell !== 1) return "cells must be 0 or 1";
        }
    }
    return undefined;
}


function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind === "terrainRules") {
        const text = value.trim();
        if (!text) return undefined; 
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return (e as Error).message;
        }
        if (!Array.isArray(parsed)) return "must be a JSON array [ ]";
        for (const [i, rule] of parsed.entries()) {
            if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
                return `rule ${i + 1} must be an object`;
            }
            const r = rule as Record<string, unknown>;
            if (r.cellType === undefined && r.terrainType === undefined) {
                return `rule ${i + 1}: pick a terrain`;
            }
            if (r.damage !== undefined && !Number.isFinite(Number(r.damage))) {
                return `rule ${i + 1}: damage must be a number`;
            }
        }
        return undefined;
    }
    if (field.kind === "json" && field.jsonType === "matrix") {
        const text = value.trim();
        
        if (!text) return undefined;
        
        
        
        
        try {
            return validateMatrix(JSON.parse(text));
        } catch (e) {
            return (e as Error).message;
        }
    }
    return undefined;
}


function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind === "terrainRules") return renderTerrainRules(ctx);
    if (ctx.field.kind === "excavationOption") return renderExcavationOption(ctx);
    return null;
}




const FORM_COVERED = ["power", "pattern", "terrainRules", "options", ...OPTION_COVERED];

export const excavationDefinition: Definition = {
    tab: "excavation",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validateField,
    
    
    panel: { renderField },
};
import {
    excavationOptionField,
    OPTION_COVERED,
    OPTIONS_FORM_KEY,
    PARAMS_FORM_KEY,
    readExcavationOption,
    writeExcavationOption,
} from "../../control/excavation-option-field.ts";
import { renderExcavationOption } from "../../control/excavation-option-control.ts";
import { listElements, listTerrains } from "../../../catalog.ts";
import * as S from "../../styles.ts";
import { idField, numField } from "../fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "../types.ts";
