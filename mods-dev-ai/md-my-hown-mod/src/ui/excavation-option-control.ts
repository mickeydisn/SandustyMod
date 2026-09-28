/**
 * The `excavationOption` control: one option, and its parameters.
 *
 * **Not** the `actionList` control, and that difference is the feature. A profile
 * holds a single `ExcavationOption` whose return is its `power` + `options`, so this
 * widget has no rows, no reordering, no repeat button and no "add" dropdown — there
 * is no list to manage. It is a dropdown, plus the chosen option's parameters.
 *
 * It borrows its parameter inputs from `param-controls.ts` rather than writing its
 * own, because a parameter is a parameter: a number box that behaved differently
 * here than it does on a signal would be a small, permanent surprise.
 *
 * ## The preview is the point
 *
 * The author is choosing a *function*, and the preview is what that function returns
 * with the parameters they just typed. It is built by calling the real option, so it
 * cannot show values the engine would not get. It is labelled with the actual
 * `registerProfile` payload shape — `power` at the top level, the flags under
 * `options` — because that nesting is the one non-obvious thing about this feature.
 */
import {
    EXCAVATION_OPTION_DOCS,
    EXCAVATION_OPTIONS,
    excavationOptionKeys,
    excavationOptionParams,
    resolveExcavationOption,
} from "../handler/excavation-option/index.ts";
import type { HandlerParam } from "../handler/core/handler-registry.ts";
import { paramInput, paramText, paramValue } from "./param-controls.ts";
import { OPTIONS_FORM_KEY, PARAMS_FORM_KEY } from "./definition/excavation-option-field.ts";
import * as S from "./styles.ts";
import type { FieldContext } from "./definition/types.ts";

type H = FieldContext["h"];

/** The declared params of an excavation option, as `HandlerParam`s for the inputs. */
function paramSpecs(key: string): HandlerParam[] {
    return excavationOptionParams(key).map((p) => ({
        key: p.key,
        label: p.key,
        kind: typeof p.def === "boolean" ? "bool" : "number",
        def: String(p.def),
    }));
}

/** The stored params, tolerating text the field's own error will report. */
function readParams(text: string | undefined): Record<string, unknown> {
    if (!text?.trim()) return {};
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
        // Left alone: rewriting it would destroy what the author was typing. The
        // field reports the parse error and Save stays blocked, which is enough.
        return {};
    }
}

export function renderExcavationOption(ctx: FieldContext): unknown {
    const { h, form, setField } = ctx;
    const key = form[OPTIONS_FORM_KEY] ?? "";
    const known = !key || EXCAVATION_OPTIONS[key] !== undefined;
    const specs = key && known ? paramSpecs(key) : [];
    const stored = readParams(form[PARAMS_FORM_KEY]);
    // The preview is the real function, not a reconstruction of it.
    const preview = key && known ? resolveExcavationOption(key)!(stored) : undefined;

    const setParam = (spec: HandlerParam, text: string) => {
        const next = { ...stored };
        const v = paramValue(spec, text);
        if (v === undefined) delete next[spec.key];
        else next[spec.key] = v;
        setField(PARAMS_FORM_KEY, JSON.stringify(next, null, 2));
    };

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 8 } },
        h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            h(
                "select",
                {
                    key: "opt",
                    style: { ...S.input, cursor: "pointer" },
                    value: key,
                    onChange: (e: { target: { value: string } }) => {
                        // Changing the preset clears the parameters with it, for the
                        // same reason as the projectile option: a leftover `power` from
                        // the old preset would be accepted by the new one — it is a
                        // declared key everywhere — but mean something different, and
                        // the author would be left wondering why the drill digs at 24.
                        setField(OPTIONS_FORM_KEY, e.target.value);
                        setField(PARAMS_FORM_KEY, "");
                    },
                },
                h("option", { value: "" }, "— set power by hand —"),
                // A stored key that no longer exists must still be shown, or the
                // dropdown would display the first option and quietly save a lie.
                !known ? h("option", { value: key }, `${key} (unknown)`) : null,
                ...excavationOptionKeys().map((k) => h("option", { key: k, value: k }, k)),
            ),
            h(
                "div",
                { style: S.hint },
                EXCAVATION_OPTION_DOCS[key] ??
                    "A profile's power and dig flags come from exactly one function, not " +
                        "a list. Leave this empty to use the power and options below.",
            ),
        ),
        // Say "no parameters" rather than showing an empty box, which reads as
        // something missing.
        key && known && specs.length === 0
            ? h("div", { style: S.hint }, "This option takes no parameters.")
            : null,
        ...(specs.length > 0 ? [paramRows(h, specs, stored, setParam)] : []),
        preview
            ? h(
                "div",
                { style: S.noteBox },
                h("div", { style: S.label }, "Result"),
                h(
                    "div",
                    { style: S.hint },
                    "The power and options registerProfile() will get. The pattern and " +
                        "terrain rules below are still yours:",
                ),
                h("pre", { style: S.codeBlock }, JSON.stringify(preview, null, 2)),
            )
            : null,
    );
}

/** The parameter rows, and the line naming the preset's defaults. */
function paramRows(
    h: H,
    specs: HandlerParam[],
    stored: Record<string, unknown>,
    setParam: (spec: HandlerParam, text: string) => void,
): unknown {
    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 4 } },
        h("span", { style: S.label }, "Parameters"),
        ...specs.map((spec) =>
            h(
                "div",
                { key: spec.key, style: { display: "flex", alignItems: "center", gap: 6 } },
                h("span", { style: { ...S.label, minWidth: 120, fontSize: 11 } }, spec.key),
                paramInput(h, spec, paramText(stored, spec), (v) => setParam(spec, v)),
            )
        ),
        h(
            "div",
            { style: S.hint },
            `Defaults: ${JSON.stringify(Object.fromEntries(specs.map((s) => [s.key, s.def])))}`,
        ),
    );
}
