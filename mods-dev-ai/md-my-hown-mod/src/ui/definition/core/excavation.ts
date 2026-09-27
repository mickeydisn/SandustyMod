/**
 * The **excavation profile** object definition.
 *
 * A profile is what a tool digs with: a power, the cells a dig removes
 * (`pattern`, a rectangular 0/1 matrix), and a per-terrain rule list. It is the
 * only object with two controls of its own, and both earn it:
 *
 *   - `pattern` is a grid of 0/1 with its own shape rules (rectangular, 0/1),
 *     which the generic `matrix` json check shares but a definition states for
 *     itself;
 *   - `terrainRules` is a repeating row editor whose rows are
 *     `{ cellType, damage, outputElementType }` — a shape no textarea should
 *     ever ask a person to hand-write.
 *
 * The `terrainRules` widget used to be completely unreachable: the register
 * layer dropped `terrainRules` on the floor and the form had no field for it.
 * Both halves now live here, in the one file that has to be read to change
 * either.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.excavation.md`.
 */

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    numField("power", "Power", "Profile", { required: true, min: 0, max: 1000, def: "10" }),
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
        hint: "{ fromGun?, fromDrill?, drillTierDamage? (0–1000), forceRemoveAll?, … }",
        placeholder: '{ "fromDrill": true }',
    },
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole profile. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("power", read.num(e.power));
    read.put("patternJson", read.json(e.pattern));
    read.put("terrainRulesJson", read.json(e.terrainRules));
    read.put("optionsJson", read.json(e.options));
}

/** Form strings → stored entry, for the whole profile. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setNum("power", w.optNum("power"));
    const pattern = w.optJson<number[][]>("patternJson");
    if (pattern) w.setRaw("pattern", pattern);
    // Only written when there is at least one rule: an empty array is not a
    // profile that treats every terrain the same, it is a profile carrying a
    // list the engine has to check and find nothing in.
    const rules = w.optJson<Record<string, unknown>[]>("terrainRulesJson");
    if (rules && rules.length > 0) w.setRaw("terrainRules", rules);
    const options = w.optJson<Record<string, unknown>>("optionsJson");
    if (options) w.setRaw("options", options);
}

// ── The terrain-rule row editor ───────────────────────────────────────────────

/**
 * Repeating `{ cellType, damage, outputElementType }` rows.
 *
 * The two ids are stored as ids here and resolved to runtime handles by
 * `registerExcavationProfile`, so the pickers offer the *names* and the engine
 * is the one that resolves them. An empty damage or drop **deletes** the key
 * rather than writing an empty string, because a rule carrying `damage: ""` is
 * a rule the engine has to reject.
 */
function renderTerrainRules(ctx: FieldContext): unknown {
    const { h, field, value, setField } = ctx;
    let rows: Record<string, unknown>[] = [];
    try {
        const parsed = JSON.parse(value || "[]");
        if (Array.isArray(parsed)) rows = parsed;
    } catch { /* raw value stays; validation reports it */ }
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

/** A rectangular grid of 0/1, which is what a dig pattern has to be. */
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

/**
 * Validate one excavation-only field kind.
 *
 * Both rules are here rather than in the generic validator for the same reason
 * the widget is: only a profile has either. `matrix` states what a dig pattern
 * must be, and `terrainRules` states that a rule naming no terrain matches
 * nothing at all — which is a rule the author has to notice, not one the engine
 * will complain about.
 *
 * Both branches are reached with an *empty* value too — `validateField` asks the
 * definition before answering "required" — so neither may assume the text
 * parses. An empty required pattern is simply "required", and an empty
 * `terrainRules` is simply no rules.
 */
function validateField(field: FieldSpec, value: string): string | undefined {
    if (field.kind === "terrainRules") {
        const text = value.trim();
        if (!text) return undefined; // no rules at all — the profile is uniform
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
        // Empty is the generic "required"'s business.
        if (!text) return undefined;
        // This definition is asked *before* the generic `json` case runs, so
        // unparseable text reaches here first. A validator that throws takes the
        // whole panel down, so the parse is guarded and reported like any other
        // syntax error — the generic case will say the same thing a moment later.
        try {
            return validateMatrix(JSON.parse(text));
        } catch (e) {
            return (e as Error).message;
        }
    }
    return undefined;
}

/**
 * The control for whichever excavation-only kind this field is, or `null` for
 * the generic ones the panel already knows how to draw.
 */
function renderField(ctx: FieldContext): unknown {
    if (ctx.field.kind !== "terrainRules") return null;
    return renderTerrainRules(ctx);
}

// ── The definition ───────────────────────────────────────────────────────────

/**
 * Stored keys this form owns.
 *
 * `pattern`, `terrainRules` and `options` are the stored key names, listed as
 * themselves; `patternJson`, `terrainRulesJson` and `optionsJson` are the
 * *controls* for them and are deliberately absent, so the real keys do not also
 * fall through the passthrough as duplicates.
 */
const FORM_COVERED = ["power", "pattern", "terrainRules", "options"];

export const excavationDefinition: Definition = {
    tab: "excavation",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validateField,
    // No `validate`: every rule is either per-field (power's range, the matrix
    // and terrainRules shapes above) or a `required` flag.
    panel: { renderField },
};
import { listElements, listTerrains } from "../../catalog.ts";
import * as S from "../styles.ts";
import { idField, numField } from "./fields.ts";
import type { Definition, EntryReader, EntryWriter, FieldContext, FieldSpec } from "./types.ts";
