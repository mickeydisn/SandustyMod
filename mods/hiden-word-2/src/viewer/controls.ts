/**
 * Shared form widgets — number inputs only (no range).
 */
import { CODE_OPTIONS } from "../constants.ts";

declare const sandkit: { react: any };
const react = sandkit.react;
export const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

export function numberRow(
  label: string,
  value: number,
  onChange: (v: number) => void,
  step = 1,
): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "number",
      step,
      value,
      onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value) || 0),
    }),
  );
}

export function checkRow(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "checkbox",
      checked,
      onChange: (e: { target: { checked: boolean } }) => onChange(!!e.target.checked),
    }),
  );
}

export function textRow(
  label: string,
  value: string,
  onChange: (v: string) => void,
): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "text",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
  );
}

export function section(
  title: string,
  enabled: boolean | null,
  onEnable: ((v: boolean) => void) | null,
  children: unknown[],
): unknown {
  return h(
    "details",
    { className: "hwv-details" },
    h(
      "summary",
      null,
      enabled === null
        ? null
        : h("input", {
          type: "checkbox",
          checked: enabled,
          onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
          onChange: (e: { target: { checked: boolean } }) => onEnable?.(!!e.target.checked),
        }),
      title,
    ),
    h("div", { className: "hwv-details-body" }, ...children),
  );
}

export function groupLabel(text: string): unknown {
  return h("div", { className: "hwv-group" }, text);
}

function colorOf(id: number): string {
  return CODE_OPTIONS.find((o) => o.id === id)?.color ?? "#888";
}
function labelOf(id: number): string {
  return CODE_OPTIONS.find((o) => o.id === id)?.label ?? String(id);
}

/** Single terrain: color tag + select (same pattern as multi). */
export function terrainSelect(
  label: string,
  value: number,
  onChange: (id: number) => void,
): unknown {
  return h(
    "div",
    null,
    h("div", { className: "hwv-mini" }, label),
    h(
      "div",
      { className: "hwv-tag-row" },
      h(
        "span",
        {
          className: "hwv-terrain-tag",
          title: labelOf(value),
        },
        h("i", {
          className: "hwv-swatch",
          style: { background: colorOf(value) },
        }),
        labelOf(value),
      ),
      h(
        "select",
        {
          value: String(value),
          onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
        },
        ...CODE_OPTIONS.map((o) =>
          h("option", { value: String(o.id) }, o.label),
        ),
      ),
    ),
  );
}

/** Multi terrain: one select to add + chips with color to remove. */
export function terrainMulti(
  label: string,
  values: number[],
  onChange: (ids: number[]) => void,
): unknown {
  return h(
    "div",
    null,
    h("div", { className: "hwv-mini" }, label),
    h(
      "div",
      { className: "hwv-tag-row" },
      ...values.map((id) =>
        h(
          "button",
          {
            type: "button",
            className: "hwv-btn",
            title: `Remove ${labelOf(id)}`,
            style: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px" },
            onClick: () => onChange(values.filter((x) => x !== id)),
          },
          h("i", {
            className: "hwv-swatch",
            title: labelOf(id),
            style: { background: colorOf(id) },
          }),
          labelOf(id),
          " ×",
        ),
      ),
    ),
    h(
      "div",
      { className: "hwv-row" },
      h(
        "select",
        {
          value: "",
          onChange: (e: { target: { value: string } }) => {
            const id = Number(e.target.value);
            if (!Number.isFinite(id) || values.includes(id)) return;
            onChange([...values, id]);
          },
        },
        h("option", { value: "" }, "+ add…"),
        ...CODE_OPTIONS.filter((o) => !values.includes(o.id)).map((o) =>
          h("option", { value: String(o.id) }, o.label),
        ),
      ),
    ),
  );
}

export function boundsEditor(
  bounds: { top: number; bottom: number; left: number; right: number },
  onChange: (b: typeof bounds) => void,
): unknown {
  const field = (key: "top" | "bottom" | "left" | "right", lab: string) =>
    h(
      "div",
      { className: "hwv-row" },
      h("label", null, lab),
      h("input", {
        type: "number",
        min: 0,
        max: 100,
        step: 1,
        value: bounds[key],
        onChange: (e: { target: { value: string } }) => {
          const n = Math.min(100, Math.max(0, Number(e.target.value) || 0));
          onChange({ ...bounds, [key]: n });
        },
      }),
      h("span", { className: "hwv-mini" }, "%"),
    );
  return h(
    "div",
    null,
    h("div", { className: "hwv-mini" }, "Bounds % of full map"),
    field("top", "Top"),
    field("bottom", "Bottom"),
    field("left", "Left"),
    field("right", "Right"),
  );
}

export function nearMaskEditor(
  mask: [number, number, number, number],
  onChange: (m: [number, number, number, number]) => void,
): unknown {
  const labels = ["Up", "Right", "Down", "Left"];
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, "Near mask"),
    ...labels.map((lab, i) =>
      h(
        "label",
        { style: { flex: "0 0 auto", display: "flex", gap: 4, alignItems: "center" } },
        h("input", {
          type: "checkbox",
          checked: !!mask[i],
          onChange: (e: { target: { checked: boolean } }) => {
            const m: [number, number, number, number] = [...mask] as typeof mask;
            m[i] = e.target.checked ? 1 : 0;
            onChange(m);
          },
        }),
        lab,
      ),
    ),
  );
}
